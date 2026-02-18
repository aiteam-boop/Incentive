const IncentiveLedger = require('../models/IncentiveLedger');
const MonthlyPerformance = require('../models/MonthlyPerformance');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');

// Default settings
const DEFAULTS = {
  sql_incentive_rate: 300,
  sql_incentive_cap: 500,
  closure_incentive_rate: 1000,
  closure_incentive_cap: 1000,
  sql_milestone_threshold: 10,
  sql_milestone_bonus: 10000,
  po_milestone_threshold: 25,
  po_milestone_bonus: 50000,
};

// Get current month string (YYYY-MM)
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Get a setting value with fallback to default
async function getSetting(key) {
  const setting = await Settings.findOne({ key });
  return setting ? setting.value : DEFAULTS[key];
}

// Get all settings as an object
async function getAllSettings() {
  const settings = await Settings.find({});
  const result = { ...DEFAULTS };
  settings.forEach((s) => {
    result[s.key] = s.value;
  });
  return result;
}

/**
 * Calculate and create Prospector incentive when SQL is verified
 */
async function calculateProspectorIncentive(lead, adminUserId) {
  const month = getCurrentMonth();

  // Check for existing non-reversed incentive
  const existing = await IncentiveLedger.findOne({
    userId: lead.createdByProspector,
    leadId: lead._id,
    incentiveType: 'SQL',
    status: { $ne: 'Reversed' },
  });

  if (existing) {
    return { success: false, message: 'Incentive already exists for this lead' };
  }

  const rate = await getSetting('sql_incentive_rate');
  const cap = await getSetting('sql_incentive_cap');
  const amount = Math.min(rate, cap);

  const ledgerEntry = await IncentiveLedger.create({
    userId: lead.createdByProspector,
    leadId: lead._id,
    incentiveType: 'SQL',
    amount,
    status: 'Pending',
    month,
    description: `SQL Verification Incentive for lead: ${lead.leadName}`,
  });

  // Log audit
  await AuditLog.create({
    userId: adminUserId,
    action: 'INCENTIVE_CREATED',
    entity: 'IncentiveLedger',
    entityId: ledgerEntry._id,
    details: { leadId: lead._id, type: 'SQL', amount, prospectorId: lead.createdByProspector },
  });

  return { success: true, incentive: ledgerEntry };
}

/**
 * Calculate SQL Closure team incentive when PO is generated
 */
async function calculateClosureIncentive(lead, adminUserId) {
  const month = getCurrentMonth();

  if (!lead.assignedSqlCloser) {
    return { success: false, message: 'No SQL Closer assigned to this lead' };
  }

  // Check for existing non-reversed incentive
  const existing = await IncentiveLedger.findOne({
    userId: lead.assignedSqlCloser,
    leadId: lead._id,
    incentiveType: 'Closure',
    status: { $ne: 'Reversed' },
  });

  if (existing) {
    return { success: false, message: 'Closure incentive already exists for this lead' };
  }

  const rate = await getSetting('closure_incentive_rate');
  const cap = await getSetting('closure_incentive_cap');
  const amount = Math.min(rate, cap);

  const ledgerEntry = await IncentiveLedger.create({
    userId: lead.assignedSqlCloser,
    leadId: lead._id,
    incentiveType: 'Closure',
    amount,
    status: 'Pending',
    month,
    description: `PO Generation Incentive for lead: ${lead.leadName}`,
  });

  // Update monthly performance
  await updateMonthlyPerformance(lead.assignedSqlCloser, month, 'po');

  // Log audit
  await AuditLog.create({
    userId: adminUserId || lead.assignedSqlCloser,
    action: 'INCENTIVE_CREATED',
    entity: 'IncentiveLedger',
    entityId: ledgerEntry._id,
    details: { leadId: lead._id, type: 'Closure', amount, closerId: lead.assignedSqlCloser },
  });

  return { success: true, incentive: ledgerEntry };
}

/**
 * Update monthly performance counters and check for milestone bonuses
 */
async function updateMonthlyPerformance(userId, month, type) {
  let perf = await MonthlyPerformance.findOne({ userId, month });

  if (!perf) {
    perf = await MonthlyPerformance.create({ userId, month });
  }

  if (type === 'sql_closed') {
    perf.sqlClosedCount += 1;
  } else if (type === 'po') {
    perf.poCount += 1;
  }

  await perf.save();

  // Check and award milestone bonuses
  await checkMilestoneBonuses(userId, month, perf);

  return perf;
}

/**
 * Check milestone bonuses for SQL Closure team
 */
async function checkMilestoneBonuses(userId, month, perf) {
  const settings = await getAllSettings();

  // Milestone 1: SQL Completion Bonus
  if (
    perf.sqlClosedCount >= settings.sql_milestone_threshold &&
    !perf.sqlMilestoneBonusPaid
  ) {
    const bonusAmount = settings.sql_milestone_bonus;

    await IncentiveLedger.create({
      userId,
      leadId: new (require('mongoose').Types.ObjectId)(), // Placeholder for bonus entries
      incentiveType: 'Bonus_SQL_Milestone',
      amount: bonusAmount,
      status: 'Approved',
      month,
      description: `SQL Milestone Bonus: Closed ${perf.sqlClosedCount} SQLs in ${month}`,
    });

    perf.sqlMilestoneBonusPaid = true;
    perf.totalBonuses += bonusAmount;
    await perf.save();

    await AuditLog.create({
      userId,
      action: 'MILESTONE_BONUS_AWARDED',
      entity: 'MonthlyPerformance',
      entityId: perf._id,
      details: { milestone: 'SQL_Completion', count: perf.sqlClosedCount, bonus: bonusAmount },
    });
  }

  // Milestone 2: PO Achievement Bonus
  if (
    perf.poCount >= settings.po_milestone_threshold &&
    !perf.poMilestoneBonusPaid
  ) {
    const bonusAmount = settings.po_milestone_bonus;

    await IncentiveLedger.create({
      userId,
      leadId: new (require('mongoose').Types.ObjectId)(), // Placeholder for bonus entries
      incentiveType: 'Bonus_PO_Milestone',
      amount: bonusAmount,
      status: 'Approved',
      month,
      description: `PO Milestone Bonus: Generated ${perf.poCount} POs in ${month}`,
    });

    perf.poMilestoneBonusPaid = true;
    perf.totalBonuses += bonusAmount;
    await perf.save();

    await AuditLog.create({
      userId,
      action: 'MILESTONE_BONUS_AWARDED',
      entity: 'MonthlyPerformance',
      entityId: perf._id,
      details: { milestone: 'PO_Achievement', count: perf.poCount, bonus: bonusAmount },
    });
  }
}

/**
 * Reverse an incentive (e.g., when SQL rejected or PO cancelled)
 */
async function reverseIncentive(ledgerEntryId, reason, adminUserId) {
  const entry = await IncentiveLedger.findById(ledgerEntryId);
  if (!entry) {
    return { success: false, message: 'Incentive entry not found' };
  }

  if (entry.status === 'Reversed') {
    return { success: false, message: 'Incentive already reversed' };
  }

  entry.status = 'Reversed';
  entry.reversedAt = new Date();
  entry.reversalReason = reason;
  await entry.save();

  await AuditLog.create({
    userId: adminUserId,
    action: 'INCENTIVE_REVERSED',
    entity: 'IncentiveLedger',
    entityId: entry._id,
    details: { reason, originalAmount: entry.amount, type: entry.incentiveType },
  });

  return { success: true, entry };
}

module.exports = {
  calculateProspectorIncentive,
  calculateClosureIncentive,
  updateMonthlyPerformance,
  checkMilestoneBonuses,
  reverseIncentive,
  getCurrentMonth,
  getSetting,
  getAllSettings,
  DEFAULTS,
};

