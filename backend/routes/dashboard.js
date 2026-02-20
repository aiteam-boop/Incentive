const express = require('express');
const mongoose = require('mongoose');
const IncentiveLedger = require('../models/IncentiveLedger');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Settings = require('../models/Settings');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Cutoff date — Jan 6, 2026
const CUTOFF_DATE = new Date('2026-01-06T00:00:00.000Z');

// Valid prospectors for SQL/SQL Closure incentives (only Aparna and Sapna)
const VALID_PROSPECTORS = ['Aparna', 'Sapna', 'aparna', 'sapna'];

// Helper: check if agent is a valid prospector for SQL incentives
function isValidProspectorForSQL(agentName) {
  if (!agentName) return false;
  return VALID_PROSPECTORS.includes(agentName);
}

// Helper: get leads_master collection directly
function getLeadsMaster() {
  return mongoose.connection.db.collection('leads_master');
}

// Helper: get remarks from sales_remark_form for an enquiry
async function getRemarks(enquiryCode) {
  const remarks = await mongoose.connection.db
    .collection('sales_remark_form')
    .find({ enquiry_code: enquiryCode })
    .sort({ timestamp: -1 })
    .toArray();
  return remarks;
}

/**
 * GET /api/dashboard/data
 * Main dashboard endpoint — returns role-specific data.
 * This is the ONLY data endpoint needed for the single-page dashboard.
 */
router.get('/data', authenticate, async (req, res) => {
  try {
    const role = req.user.incentive_role;
    const agentName = req.user.agentName;
    const userId = req.user._id;
    const col = getLeadsMaster();

    let leads = [];
    let incentives = [];
    let allIncentives = []; // For admin view

    if (role === 'sql_closure') {
      // SQL Closure: Show leads where Lead_Owner OR Sales_Owner matches, with PO from Jan 6
      leads = await col.find({
        $or: [{ Lead_Owner: agentName }, { Sales_Owner: agentName }],
        PO_Date: { $gte: CUTOFF_DATE },
      }).sort({ PO_Date: -1 }).toArray();

      // Also show SQL leads (without PO yet) from Jan 6, excluding Lost status
      const sqlLeads = await col.find({
        $or: [{ Lead_Owner: agentName }, { Sales_Owner: agentName }],
        SQL_Date: { $gte: CUTOFF_DATE },
        PO_Date: null,
        Status: { $ne: 'Lost' },
      }).sort({ SQL_Date: -1 }).toArray();

      leads = [...leads, ...sqlLeads];

      // Get incentives for this user
      incentives = await IncentiveLedger.find({ userId }).sort({ createdAt: -1 });

    } else if (role === 'prospector') {
      // Prospector: Show their SQL leads from Jan 6
      leads = await col.find({
        Lead_Owner: agentName,
        SQL_Date: { $gte: CUTOFF_DATE },
      }).sort({ SQL_Date: -1 }).toArray();

      // Get incentives for this user
      incentives = await IncentiveLedger.find({ userId }).sort({ createdAt: -1 });

    } else if (role === 'admin') {
      // Admin: all SQL and PO leads from Jan 6
      const poLeads = await col.find({
        PO_Date: { $gte: CUTOFF_DATE },
      }).sort({ PO_Date: -1 }).toArray();

      const sqlOnlyLeads = await col.find({
        SQL_Date: { $gte: CUTOFF_DATE },
        PO_Date: null,
      }).sort({ SQL_Date: -1 }).toArray();

      leads = [...poLeads, ...sqlOnlyLeads];

      // All incentives for all users
      allIncentives = await IncentiveLedger.find({}).sort({ createdAt: -1 });
      incentives = allIncentives;
    }

    // Calculate earnings summary
    const myIncentives = role === 'admin'
      ? allIncentives
      : await IncentiveLedger.find({ userId });

    const summary = {
      totalEarned: 0,
      totalPending: 0,
      totalEntries: myIncentives.length,
    };

    myIncentives.forEach((inc) => {
      if (inc.status !== 'Reversed') {
        if (inc.adminApproved && inc.ceoApproved) {
          summary.totalEarned += inc.amount;
        } else {
          summary.totalPending += inc.amount;
        }
      }
    });

    // Get all users with incentive roles (for admin)
    let teamUsers = [];
    if (role === 'admin') {
      teamUsers = await User.find({ incentive_role: { $ne: null } }).select('-password');
    }

    res.json({
      success: true,
      role,
      agentName,
      leads: leads.map(l => ({
        _id: l._id,
        enquiryCode: l['Enquiry Code'],
        date: l['Date'],
        leadOwner: l['Lead_Owner'],
        salesOwner: l['Sales_Owner'],
        leadSource: l['Lead_Source'],
        clientCompanyName: l['Client_Company_Name'],
        clientPersonName: l['Client_Person_Name'],
        clientNumber: l['Client_Number'],
        clientEmail: l['Client_Mail_ID'],
        industry: l['Industry'],
        product: l['Product'],
        size: l['Size'],
        location: l['Location'],
        status: l['Status'],
        sqlDate: l['SQL_Date'],
        poDate: l['PO_Date'],
        poNumber: l['PO_Number'],
        poValue: l['PO_Value'],
        poQuantity: l['PO_Quantity'],
        poLink: l['PO_Link'],
        dealValue: l['Client_Budget_Lead _Value'],
        remarks: l['Remarks'],
        followUpControl: l['follow_up_control'],
        // All remark fields
        sqlFollowUp1: l['Remarksql1'],
        sqlFollowUp2: l['Remarksql2'],
        sqlFollowUp3: l['Remarksql3'],
        poFollowUp1: l['Remarkpo1'],
        poFollowUp2: l['Remarkpo2'],
        poFollowUp3: l['Remarkpo3'],
        mqlFollowUp1: l['Remarkmql1'],
        mqlFollowUp2: l['Remarkmql2'],
        mqlFollowUp3: l['Remarkmql3'],
        srf: l['SRF_PDF_Link'],
        quotation: l['Quotation_Link'],
        leadType: l['Lead_Type'],
        quantity: l['Quantity'],
        expectedClosure: l['Expected_Closure'],
        lostDate: l['Lost_Date'],
        orderNumber: l['Order _Number'],
      })),
      incentives,
      summary,
      teamUsers,
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/dashboard/sync-incentives
 * Admin triggers sync: scans leads_master and creates missing incentive entries.
 * This is the "calculate incentives" engine.
 */
router.post('/sync-incentives', authenticate, authorize('admin'), async (req, res) => {
  try {
    const col = getLeadsMaster();
    const settings = await getSettings();
    const results = { created: 0, skipped: 0, errors: [] };

    // Get all users with incentive roles
    const users = await User.find({ incentive_role: { $ne: null } });
    const userMap = {};
    users.forEach(u => { userMap[u.agentName] = u; });

    // 1. Process SQL Closure incentives (₹1000 per PO)
    const poLeads = await col.find({ PO_Date: { $gte: CUTOFF_DATE } }).toArray();
    for (const lead of poLeads) {
      const ownerName = lead['Sales_Owner'] || lead['Lead_Owner'];
      const user = userMap[ownerName];
      if (!user || user.incentive_role !== 'sql_closure') continue;

      const enquiryCode = lead['Enquiry Code'];
      try {
        const existing = await IncentiveLedger.findOne({
          enquiryCode, incentiveType: 'CLOSURE', userId: user._id,
        });
        if (existing) { results.skipped++; continue; }

        const poDate = lead['PO_Date'] ? new Date(lead['PO_Date']) : new Date();
        const poMonth = formatMonth(poDate);
        await IncentiveLedger.create({
          userId: user._id,
          agentName: user.agentName,
          enquiryCode,
          leadMasterId: lead._id,
          clientCompanyName: lead['Client_Company_Name'],
          incentiveType: 'CLOSURE',
          amount: Math.min(settings.closure_incentive_rate, settings.closure_incentive_cap),
          month: poMonth,
          incentive_date: poDate,
          description: `PO Incentive: ${lead['Client_Company_Name']} (${enquiryCode})`,
        });
        results.created++;
      } catch (err) {
        if (err.code !== 11000) results.errors.push(`${enquiryCode}: ${err.message}`);
        else results.skipped++;
      }
    }

    // 2. Process Prospector SQL incentives (₹300 per SQL)
    // IMPORTANT: Only Aparna and Sapna are considered prospectors for SQL incentives
    // All other agents (Gauri, Anjali, Amisha, etc.) are excluded from SQL incentives
    // Note: Pushpalata and Amisha are admins, not eligible for SQL incentives
    const sqlLeads = await col.find({ SQL_Date: { $gte: CUTOFF_DATE } }).toArray();
    for (const lead of sqlLeads) {
      const ownerName = lead['Lead_Owner'];
      const user = userMap[ownerName];
      // Only process if user exists AND is a valid prospector (Aparna or Sapna)
      if (!user || !isValidProspectorForSQL(user.agentName)) continue;

      const enquiryCode = lead['Enquiry Code'];
      try {
        // SQL incentive
        const existingSQL = await IncentiveLedger.findOne({
          enquiryCode, incentiveType: 'SQL', userId: user._id,
        });
        if (!existingSQL) {
          const sqlDate = lead['SQL_Date'] ? new Date(lead['SQL_Date']) : new Date();
          const sqlMonth = formatMonth(sqlDate);
          await IncentiveLedger.create({
            userId: user._id,
            agentName: user.agentName,
            enquiryCode,
            leadMasterId: lead._id,
            clientCompanyName: lead['Client_Company_Name'],
            incentiveType: 'SQL',
            amount: Math.min(settings.sql_incentive_rate, settings.sql_incentive_cap),
            month: sqlMonth,
            incentive_date: sqlDate,
            description: `SQL Incentive: ${lead['Client_Company_Name']} (${enquiryCode})`,
          });
          results.created++;
        } else {
          results.skipped++;
        }

        // PO Conversion bonus (₹200 if PO exists)
        if (lead['PO_Date']) {
          const existingPO = await IncentiveLedger.findOne({
            enquiryCode, incentiveType: 'PO_CONVERSION', userId: user._id,
          });
          if (!existingPO) {
            const poDate = new Date(lead['PO_Date']);
            const poMonth = formatMonth(poDate);
            await IncentiveLedger.create({
              userId: user._id,
              agentName: user.agentName,
              enquiryCode,
              leadMasterId: lead._id,
              clientCompanyName: lead['Client_Company_Name'],
              incentiveType: 'PO_CONVERSION',
              amount: 200, // Fixed ₹200 for PO conversion
              month: poMonth,
              incentive_date: poDate,
              description: `PO Conversion Bonus: ${lead['Client_Company_Name']} (${enquiryCode})`,
            });
            results.created++;
          } else {
            results.skipped++;
          }
        }
      } catch (err) {
        if (err.code !== 11000) results.errors.push(`${enquiryCode}: ${err.message}`);
        else results.skipped++;
      }
    }

    await AuditLog.create({
      userId: req.user._id,
      action: 'INCENTIVES_SYNCED',
      entity: 'IncentiveLedger',
      details: results,
    });

    res.json({ success: true, results, message: `Synced: ${results.created} created, ${results.skipped} skipped` });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/dashboard/approve/:id
 * Admin approves an incentive (as Admin or CEO).
 * CEO can only approve CEO approvals, and only after admin has approved.
 */
router.put('/approve/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { approvalType } = req.body; // 'admin' or 'ceo'
    const isCEO = req.user.agentName && req.user.agentName.toLowerCase().includes('ceo');
    const entry = await IncentiveLedger.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Incentive not found' });
    if (entry.status === 'Reversed') return res.status(400).json({ success: false, message: 'Cannot approve reversed incentive' });

    // CEO restrictions: Can only approve CEO approvals, and only if admin has already approved
    if (isCEO) {
      if (approvalType === 'admin') {
        return res.status(403).json({ success: false, message: 'CEO cannot approve admin approvals' });
      }
      if (approvalType === 'ceo' && !entry.adminApproved) {
        return res.status(403).json({ success: false, message: 'CEO can only approve after admin has approved' });
      }
    }

    if (approvalType === 'ceo') {
      entry.ceoApproved = true;
      entry.ceoApprovedBy = req.user._id;
      entry.ceoApprovedAt = new Date();
    } else {
      entry.adminApproved = true;
      entry.adminApprovedBy = req.user._id;
      entry.adminApprovedAt = new Date();
    }

    // Both approved → mark as Approved
    if (entry.adminApproved && entry.ceoApproved) {
      entry.status = 'Approved';
    }

    await entry.save();

    await AuditLog.create({
      userId: req.user._id,
      action: `INCENTIVE_${approvalType.toUpperCase()}_APPROVED`,
      entity: 'IncentiveLedger',
      entityId: entry._id,
      details: { enquiryCode: entry.enquiryCode, approvalType, amount: entry.amount },
    });

    res.json({ success: true, incentive: entry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/dashboard/revoke/:id
 * Admin revokes an approval.
 * CEO cannot revoke admin approvals.
 */
router.put('/revoke/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { approvalType } = req.body; // 'admin' or 'ceo'
    const isCEO = req.user.agentName && req.user.agentName.toLowerCase().includes('ceo');
    const entry = await IncentiveLedger.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Incentive not found' });

    // CEO cannot revoke admin approvals
    if (isCEO && approvalType === 'admin') {
      return res.status(403).json({ success: false, message: 'CEO cannot revoke admin approvals' });
    }

    if (approvalType === 'ceo') {
      entry.ceoApproved = false;
      entry.ceoApprovedBy = null;
      entry.ceoApprovedAt = null;
    } else {
      entry.adminApproved = false;
      entry.adminApprovedBy = null;
      entry.adminApprovedAt = null;
    }

    // If either revoked → back to Pending
    if (!entry.adminApproved || !entry.ceoApproved) {
      entry.status = 'Pending';
    }

    await entry.save();
    res.json({ success: true, incentive: entry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/dashboard/reverse/:id
 * Admin reverses an incentive completely.
 */
router.put('/reverse/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    const entry = await IncentiveLedger.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Incentive not found' });
    if (entry.status === 'Reversed') return res.status(400).json({ success: false, message: 'Already reversed' });

    entry.status = 'Reversed';
    entry.reversedAt = new Date();
    entry.reversalReason = reason || 'Admin reversed';
    await entry.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'INCENTIVE_REVERSED',
      entity: 'IncentiveLedger',
      entityId: entry._id,
      details: { enquiryCode: entry.enquiryCode, amount: entry.amount, reason },
    });

    res.json({ success: true, incentive: entry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/dashboard/lead-details/:enquiryCode
 * Full lead details including remarks, timeline, follow-ups.
 */
router.get('/lead-details/:enquiryCode', authenticate, async (req, res) => {
  try {
    const col = getLeadsMaster();
    const lead = await col.findOne({ 'Enquiry Code': req.params.enquiryCode });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    // Role-based access check
    const role = req.user.incentive_role;
    const agentName = req.user.agentName;
    if (role === 'prospector' && lead['Lead_Owner'] !== agentName) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (role === 'sql_closure' && lead['Lead_Owner'] !== agentName && lead['Sales_Owner'] !== agentName) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get remarks from sales_remark_form
    const remarks = await getRemarks(req.params.enquiryCode);

    // Get incentives for this lead
    const incentives = await IncentiveLedger.find({ enquiryCode: req.params.enquiryCode });

    res.json({
      success: true,
      lead: {
        _id: lead._id,
        enquiryCode: lead['Enquiry Code'],
        date: lead['Date'],
        leadOwner: lead['Lead_Owner'],
        salesOwner: lead['Sales_Owner'],
        leadSource: lead['Lead_Source'],
        clientCompanyName: lead['Client_Company_Name'],
        clientPersonName: lead['Client_Person_Name'],
        clientNumber: lead['Client_Number'],
        clientEmail: lead['Client_Mail_ID'],
        industry: lead['Industry'],
        product: lead['Product'],
        size: lead['Size'],
        location: lead['Location'],
        status: lead['Status'],
        sqlDate: lead['SQL_Date'],
        poDate: lead['PO_Date'],
        poNumber: lead['PO_Number'],
        poValue: lead['PO_Value'],
        poQuantity: lead['PO_Quantity'],
        poLink: lead['PO_Link'],
        dealValue: lead['Client_Budget_Lead _Value'],
        leadType: lead['Lead_Type'],
        quantity: lead['Quantity'],
        expectedClosure: lead['Expected_Closure'],
        lostDate: lead['Lost_Date'],
        orderNumber: lead['Order _Number'],
        srf: lead['SRF_PDF_Link'],
        quotation: lead['Quotation_Link'],
        remarks: lead['Remarks'],
        followUpControl: lead['follow_up_control'],
        // All follow-up remarks
        mqlFollowUps: [
          { date: lead['MQL_Follow_Up_Date_1'], remark: lead['Remarkmql1'] },
          { date: lead['MQL_Follow_Up_Date_2'], remark: lead['Remarkmql2'] },
          { date: lead['MQL_Follow_Up_Date_3'], remark: lead['Remarkmql3'] },
        ].filter(f => f.date || f.remark),
        sqlFollowUps: [
          { date: lead['SQL_Follow_Up_Date_1'], remark: lead['Remarksql1'] },
          { date: lead['SQL_Follow_Up_Date_2'], remark: lead['Remarksql2'] },
          { date: lead['SQL_Follow_Up_Date_3'], remark: lead['Remarksql3'] },
        ].filter(f => f.date || f.remark),
        poFollowUps: [
          { date: lead['PO_Follow_Up_Date_1'], remark: lead['Remarkpo1'] },
          { date: lead['PO_Follow_Up_Date_2'], remark: lead['Remarkpo2'] },
          { date: lead['PO_Follow_Up_Date_3'], remark: lead['Remarkpo3'] },
        ].filter(f => f.date || f.remark),
      },
      remarks,
      incentives,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper: format date to YYYY-MM
function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Helper: get settings with defaults
async function getSettings() {
  const DEFAULTS = {
    sql_incentive_rate: 300,
    sql_incentive_cap: 500,
    closure_incentive_rate: 1000,
    closure_incentive_cap: 1000,
  };
  const settings = await Settings.find({});
  const result = { ...DEFAULTS };
  settings.forEach(s => { result[s.key] = s.value; });
  return result;
}

module.exports = router;

