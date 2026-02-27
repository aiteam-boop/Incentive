const express = require('express');
const IncentiveLedger = require('../models/IncentiveLedger');
const MonthlyPerformance = require('../models/MonthlyPerformance');
const Target = require('../models/Target');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { getCurrentMonth } = require('../utils/incentiveEngine');

const router = express.Router();

/**
 * GET /api/incentives/my
 * Returns current user's own incentives — filtered by role:
 *   - prospector: only SQL incentives
 *   - sql_closure: only Closure + Bonus incentives
 *   - admin: all their own incentives
 */
router.get('/my', authenticate, async (req, res) => {
  try {
    const { month, status } = req.query;
    const role = req.user.incentive_role;
    const filter = { userId: req.user._id };

    if (month) filter.month = month;
    if (status) filter.status = status;

    // Role-based type filtering
    if (role === 'prospector') {
      filter.incentiveType = 'SQL';
    } else if (role === 'sql_closure') {
      filter.incentiveType = { $in: ['Closure', 'Bonus_SQL_Milestone', 'Bonus_PO_Milestone'] };
    }

    const incentives = await IncentiveLedger.find(filter)
      .populate('leadId', 'leadName company stage')
      .sort({ createdAt: -1 });

    // Calculate summary
    const summary = {
      totalEarned: 0,
      totalPending: 0,
      totalApproved: 0,
      totalPaid: 0,
      totalReversed: 0,
    };

    incentives.forEach((inc) => {
      if (inc.status === 'Pending') summary.totalPending += inc.amount;
      else if (inc.status === 'Approved') summary.totalApproved += inc.amount;
      else if (inc.status === 'Paid') summary.totalPaid += inc.amount;
      else if (inc.status === 'Reversed') summary.totalReversed += inc.amount;

      if (['Approved', 'Paid'].includes(inc.status)) {
        summary.totalEarned += inc.amount;
      }
    });

    res.json({ success: true, incentives, summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/incentives/team
 * Admin only — all team incentives.
 */
router.get('/team', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { month, team, status } = req.query;
    const filter = {};
    if (month) filter.month = month;
    if (status) filter.status = status;

    const incentives = await IncentiveLedger.find(filter)
      .populate('userId', 'agentName username incentive_role')
      .populate('leadId', 'leadName company stage')
      .sort({ createdAt: -1 });

    // Filter by team role if specified
    let filtered = incentives;
    if (team) {
      filtered = incentives.filter((inc) => inc.userId && inc.userId.incentive_role === team);
    }

    // Group by user
    const byUser = {};
    filtered.forEach((inc) => {
      if (!inc.userId) return;
      const uid = inc.userId._id.toString();
      if (!byUser[uid]) {
        byUser[uid] = {
          user: inc.userId,
          incentives: [],
          totalPending: 0,
          totalApproved: 0,
          totalPaid: 0,
          totalReversed: 0,
        };
      }
      byUser[uid].incentives.push(inc);
      if (inc.status === 'Pending') byUser[uid].totalPending += inc.amount;
      else if (inc.status === 'Approved') byUser[uid].totalApproved += inc.amount;
      else if (inc.status === 'Paid') byUser[uid].totalPaid += inc.amount;
      else if (inc.status === 'Reversed') byUser[uid].totalReversed += inc.amount;
    });

    res.json({ success: true, teamIncentives: Object.values(byUser), total: filtered.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/incentives/monthly-performance
 * Monthly performance — filtered by role.
 */
router.get('/monthly-performance', authenticate, async (req, res) => {
  try {
    const { month } = req.query;
    const role = req.user.incentive_role;
    const filter = {};

    // Non-admins only see their own performance
    if (role !== 'admin') {
      filter.userId = req.user._id;
    }

    if (month) {
      filter.month = month;
    } else {
      filter.month = getCurrentMonth();
    }

    const performance = await MonthlyPerformance.find(filter)
      .populate('userId', 'agentName username incentive_role')
      .sort({ totalEarnings: -1 });

    res.json({ success: true, performance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/incentives/:id/approve - Admin approves an incentive
router.put('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const entry = await IncentiveLedger.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Incentive not found' });
    }

    if (entry.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Cannot approve incentive with status: ${entry.status}` });
    }

    entry.status = 'Approved';
    entry.approvedBy = req.user._id;
    entry.approvedAt = new Date();
    await entry.save();

    res.json({ success: true, incentive: entry, message: 'Incentive approved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/incentives/:id/pay - Admin marks incentive as paid
router.put('/:id/pay', authenticate, authorize('admin'), async (req, res) => {
  try {
    const entry = await IncentiveLedger.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Incentive not found' });
    }

    if (entry.status !== 'Approved') {
      return res.status(400).json({ success: false, message: `Cannot pay incentive with status: ${entry.status}` });
    }

    entry.status = 'Paid';
    entry.paidAt = new Date();
    await entry.save();

    // Update monthly performance total earnings
    await MonthlyPerformance.findOneAndUpdate(
      { userId: entry.userId, month: entry.month },
      { $inc: { totalEarnings: entry.amount } },
      { upsert: true }
    );

    res.json({ success: true, incentive: entry, message: 'Incentive marked as paid' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/incentives/:id/reverse - Admin reverses an incentive
router.put('/:id/reverse', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    const { reverseIncentive } = require('../utils/incentiveEngine');

    const result = await reverseIncentive(req.params.id, reason, req.user._id);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({ success: true, incentive: result.entry, message: 'Incentive reversed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/incentives/recalculate - Admin recalculates incentives for a lead
router.post('/recalculate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { leadId } = req.body;
    const Lead = require('../models/Lead');
    const {
      calculateProspectorIncentive,
      calculateClosureIncentive,
    } = require('../utils/incentiveEngine');

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const results = {};

    if (lead.sqlVerified) {
      results.prospector = await calculateProspectorIncentive(lead, req.user._id);
    }

    if (lead.poGenerated && !lead.poCancelled) {
      results.closure = await calculateClosureIncentive(lead, req.user._id);
    }

    res.json({ success: true, results, message: 'Recalculation complete' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/incentives/dashboard?quarter=2026-Q1
 * Returns comprehensive quarterly dashboard data with all filtered tables and metrics
 */
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const { quarter, viewAs, month } = req.query;
    let userId = req.user._id;
    let role = req.user.incentive_role;
    let agentName = req.user.agentName;
    let viewAsUser = null;

    // Check if admin/CEO/Pushpalata wants to view another user's dashboard
    const isAdmin = role === 'admin';
    const isCEO = (req.user.agentName || '').toLowerCase().includes('ceo');
    const isPushpalata = (req.user.agentName || '').toLowerCase().trim() === 'pushpalata';

    if (viewAs && (isAdmin || isCEO || isPushpalata)) {
      // Find user by userId or agentName
      let targetUser;
      if (viewAs.match(/^[0-9a-fA-F]{24}$/)) {
        // It's a MongoDB ObjectId
        targetUser = await User.findById(viewAs).select('-password');
      } else {
        // It's an agentName
        targetUser = await User.findOne({ agentName: viewAs }).select('-password');
      }

      if (targetUser && targetUser.incentive_role) {
        viewAsUser = targetUser;
        userId = targetUser._id;
        role = targetUser.incentive_role;
        agentName = targetUser.agentName;
      } else {
        return res.status(404).json({ success: false, message: 'User not found or does not have incentive access' });
      }
    }

    // SQL Closure team members (by agentName) - even if they have admin role
    // These users should only see PO closure incentives, not SQL incentives
    const SQL_CLOSURE_TEAM = ['Pushpalata', 'pushpalata', 'Anjali', 'anjali', 'Gauri', 'gauri', 'Amisha', 'amisha'];
    const isSQLClosureTeamMember = SQL_CLOSURE_TEAM.includes(agentName);
    // Use SQL Closure logic if user is in SQL Closure team OR has sql_closure role
    const shouldTreatAsSQLClosure = isSQLClosureTeamMember || role === 'sql_closure';

    if (!quarter) {
      return res.status(400).json({ success: false, message: 'Quarter parameter is required (e.g., 2026-Q1)' });
    }

    // Validate quarter format (YYYY-Q1, YYYY-Q2, etc.)
    const quarterMatch = quarter.match(/^(\d{4})-Q([1-4])$/);
    if (!quarterMatch) {
      return res.status(400).json({ success: false, message: 'Invalid quarter format. Use YYYY-Q1, YYYY-Q2, YYYY-Q3, or YYYY-Q4' });
    }

    const year = parseInt(quarterMatch[1]);
    const quarterNum = parseInt(quarterMatch[2]);

    // Calculate quarter date range
    let quarterStart, quarterEnd;
    if (quarterNum === 1) {
      quarterStart = new Date(year, 0, 1); // Jan 1
      quarterEnd = new Date(year, 2, 31, 23, 59, 59, 999); // Mar 31
    } else if (quarterNum === 2) {
      quarterStart = new Date(year, 3, 1); // Apr 1
      quarterEnd = new Date(year, 5, 30, 23, 59, 59, 999); // Jun 30
    } else if (quarterNum === 3) {
      quarterStart = new Date(year, 6, 1); // Jul 1
      quarterEnd = new Date(year, 8, 30, 23, 59, 59, 999); // Sep 30
    } else {
      quarterStart = new Date(year, 9, 1); // Oct 1
      quarterEnd = new Date(year, 11, 31, 23, 59, 59, 999); // Dec 31
    }

    let filterStart = quarterStart;
    let filterEnd = quarterEnd;

    if (month) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = monthNames.indexOf(month);
      if (mIdx !== -1) {
        filterStart = new Date(year, mIdx, 1);
        filterEnd = new Date(year, mIdx + 1, 0, 23, 59, 59, 999);
      }
    }

    // Helper function to get date filter for incentives
    const getIncentiveDateFilter = () => ({
      $or: [
        { incentive_date: { $gte: filterStart, $lte: filterEnd } },
        { incentive_date: { $exists: false }, createdAt: { $gte: filterStart, $lte: filterEnd } },
      ],
    });

    // Step 1: Get target for this quarter
    // First try the Target model
    let target = await Target.findOne({ user_id: userId, quarter });

    let sql_target = 0;
    let closure_target = 0;
    let po_target = 0;
    let incentive_per_po = 1000;
    let incentive_per_sql = 300;

    if (target) {
      // Use Target model data
      sql_target = target.sql_target || 0;
      closure_target = target.closure_target || 0;
      po_target = target.po_target || 0;
      incentive_per_po = target.incentive_per_po || 1000;
      incentive_per_sql = target.incentive_per_sql || 300;
    } else {
      // Try alternative target collection structure (using Lead_Owner)
      const mongoose = require('mongoose');
      const altTargetsCollection = mongoose.connection.db.collection('targets');
      const altTarget = await altTargetsCollection.findOne({ Lead_Owner: agentName });

      if (altTarget) {
        // Map alternative structure to our format
        sql_target = altTarget['Quaterly Sql Target'] || 0;
        closure_target = altTarget['Quaterly Closure Target'] || 0;
        po_target = altTarget['Quaterly Po Target'] || 0;
        // For incentive calculation, ALWAYS use configured closure incentive rate (₹1,000 per PO by design)
        // Monthly Price in this collection represents revenue targets, NOT incentive per PO.
        incentive_per_po = 1000;
        incentive_per_sql = 300; // Standard SQL incentive rate
      }
    }

    // Calculate target potential
    // For SQL Closure team members: only PO potential (they don't have SQL targets)
    // For Prospector role: PO + SQL potential
    const po_potential = po_target * incentive_per_po;
    let sql_potential = shouldTreatAsSQLClosure ? 0 : (sql_target * incentive_per_sql);
    const target_potential = po_potential + sql_potential;

    // For SQL Closure team members, set sql_target to 0 since they don't track SQL targets
    if (shouldTreatAsSQLClosure) {
      sql_target = 0;
      sql_potential = 0;
    }

    // Step 2: Get earned incentives (quarterly & filtered)
    const allQuarterEarnedIncentives = await IncentiveLedger.find({
      userId,
      status: { $ne: 'Reversed' },
      adminApproved: true,
      ceoApproved: true,
      $or: [
        { incentive_date: { $gte: quarterStart, $lte: quarterEnd } },
        { incentive_date: { $exists: false }, createdAt: { $gte: quarterStart, $lte: quarterEnd } },
      ],
    });

    const monthly_breakdown = { Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0 };
    const monthNamesData = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    allQuarterEarnedIncentives.forEach(inc => {
      const d = inc.incentive_date || inc.createdAt;
      if (d) {
        const m = d.getMonth();
        monthly_breakdown[monthNamesData[m]] += inc.amount;
      }
    });

    // Determine earned for the current filter (quarter or specific month)
    const earnedIncentives = await IncentiveLedger.find({
      userId,
      status: { $ne: 'Reversed' },
      adminApproved: true,
      ceoApproved: true,
      ...getIncentiveDateFilter(),
    });
    const earned = earnedIncentives.reduce((sum, inc) => sum + inc.amount, 0);

    // Step 3: Get pending incentives (not yet approved by both)
    const pendingIncentives = await IncentiveLedger.find({
      userId,
      status: { $ne: 'Reversed' },
      $or: [
        { adminApproved: false },
        { ceoApproved: false },
      ],
      ...getIncentiveDateFilter(),
    });
    const pending = pendingIncentives.reduce((sum, inc) => sum + inc.amount, 0);

    // Step 4: Get all incentives for this quarter (for total entries)
    const allQuarterIncentives = await IncentiveLedger.find({
      userId,
      status: { $ne: 'Reversed' },
      ...getIncentiveDateFilter(),
    });
    const total_entries = allQuarterIncentives.length;

    // Step 5: Calculate remaining and achievement using target_potential
    const remaining = Math.max(0, target_potential - earned);
    const achievement_percentage = target_potential > 0
      ? (earned / target_potential) * 100
      : 0;

    // Step 6: Get leads_master collection for filtering leads
    const mongoose = require('mongoose');
    const getLeadsMaster = () => mongoose.connection.db.collection('leads_master');
    const col = getLeadsMaster();

    // Step 7: Get PO incentives table data (for SQL Closure role + Admin overview)
    let poIncentives = [];
    if (role === 'sql_closure' || role === 'admin' || (isAdmin && viewAs)) {
      // Get PO leads within quarter date range
      // If viewing a specific user, filter by their agentName
      const poLeadsFilter = (isAdmin && !viewAs)
        ? {}
        : { $or: [{ Lead_Owner: agentName }, { Sales_Owner: agentName }] };

      const poLeads = await col.find({
        ...poLeadsFilter,
        PO_Date: {
          $gte: filterStart,
          $lte: filterEnd,
        },
      }).sort({ PO_Date: -1 }).toArray();

      // Get incentives for these leads
      const enquiryCodes = poLeads.map(l => l['Enquiry Code']);

      // Build query for PO incentives
      let incentiveQuery = {
        incentiveType: 'CLOSURE',
        status: { $ne: 'Reversed' },
        ...getIncentiveDateFilter(),
      };

      // If admin viewing own dashboard, get all PO incentives (will include Pushpalata's own)
      // If viewing specific user, get only that user's incentives
      // Otherwise, get incentives matching the PO leads enquiry codes
      if (isAdmin && !viewAs) {
        // Admin viewing own dashboard: get all PO incentives (not filtered by enquiryCode)
        // This includes Pushpalata's own incentives + team members' incentives
        incentiveQuery.userId = { $exists: true };
      } else if (viewAs) {
        // Viewing specific user: get only their incentives
        incentiveQuery.userId = userId;
        incentiveQuery.enquiryCode = { $in: enquiryCodes };
      } else {
        // SQL Closure viewing own dashboard: get their incentives matching PO leads
        incentiveQuery.userId = userId;
        incentiveQuery.enquiryCode = { $in: enquiryCodes };
      }

      let poIncentiveRecords = await IncentiveLedger.find(incentiveQuery).sort({ createdAt: -1 });

      // Ensure we have lead data for all incentives (especially for Pushpalata's own incentives)
      // If an incentive doesn't have a matching lead in poLeads, we still want to include it
      const allEnquiryCodes = new Set(enquiryCodes);
      poIncentiveRecords.forEach(inc => {
        if (inc.enquiryCode && !allEnquiryCodes.has(inc.enquiryCode)) {
          allEnquiryCodes.add(inc.enquiryCode);
        }
      });

      // Fetch any missing leads for incentives that don't have matching PO leads
      if (allEnquiryCodes.size > enquiryCodes.length) {
        const missingCodes = Array.from(allEnquiryCodes).filter(code => !enquiryCodes.includes(code));
        const missingLeads = await col.find({
          'Enquiry Code': { $in: missingCodes },
          PO_Date: {
            $gte: filterStart,
            $lte: filterEnd,
          },
        }).toArray();

        // Add missing leads to poLeads
        missingLeads.forEach(l => {
          poLeads.push(l);
        });
      }

      // For Admin/CEO view when NOT viewing a specific user:
      // - If it's CEO viewing, show SQL Closure team members (Gauri, Anjali, Amisha)
      // - If it's Admin (Pushpalata) viewing own dashboard, include her own incentives + team members for approval sections
      // But if viewing a specific user, show only that user's incentives
      if (isAdmin && !viewAs && isCEO) {
        // CEO viewing: only show SQL Closure team members (excluding CEO and Pushpalata)
        const SQL_CLOSURE_TEAM = ['Gauri', 'gauri', 'Anjali', 'anjali', 'Amisha', 'amisha'];
        poIncentiveRecords = poIncentiveRecords.filter(inc => SQL_CLOSURE_TEAM.includes(inc.agentName));
      } else if (viewAs) {
        // When viewing a specific user, filter to only that user's incentives
        poIncentiveRecords = poIncentiveRecords.filter(inc => inc.userId.toString() === userId.toString());
      }
      // If admin (Pushpalata) viewing own dashboard (!viewAs && !isCEO), return all PO incentives
      // Frontend will filter Pushpalata's own incentives in the admin personal section
      // and show team members' incentives in the approval sections

      // Map leads with their incentives
      const leadMap = {};
      poLeads.forEach(l => {
        leadMap[l['Enquiry Code']] = {
          _id: l._id,
          enquiryCode: l['Enquiry Code'],
          clientCompanyName: l['Client_Company_Name'],
          leadOwner: l['Lead_Owner'],
          salesOwner: l['Sales_Owner'],
          poDate: l['PO_Date'],
          poValue: l['PO_Value'],
          poNumber: l['PO_Number'],
        };
      });

      poIncentives = poIncentiveRecords.map(inc => {
        const lead = leadMap[inc.enquiryCode] || {};
        return {
          ...inc.toObject(),
          lead,
        };
      });
    }

    // Step 8: Get SQL leads table data (for SQL Closure role - SQL leads without PO)
    let sqlLeads = [];
    if (role === 'sql_closure') {
      sqlLeads = await col.find({
        $or: [{ Lead_Owner: agentName }, { Sales_Owner: agentName }],
        SQL_Date: {
          $gte: filterStart,
          $lte: filterEnd,
        },
        PO_Date: null,
        Status: { $ne: 'Lost' },
      }).sort({ SQL_Date: -1 }).toArray();

      sqlLeads = sqlLeads.map(l => ({
        _id: l._id,
        enquiryCode: l['Enquiry Code'],
        clientCompanyName: l['Client_Company_Name'],
        sqlDate: l['SQL_Date'],
        status: l['Status'],
      }));
    }

    // Step 9: Get Prospector SQL leads (for Prospector role — ONLY Aparna & Sapna)
    let prospectorLeads = [];
    let prospectorIncentives = [];
    if (role === 'prospector' || role === 'admin') {
      // Limit prospectors strictly to Aparna and Sapna
      const validProspectors = ['Aparna', 'Sapna', 'aparna', 'sapna'];
      const baseFilter = { Lead_Owner: { $in: validProspectors } };
      const filter = (isAdmin && !viewAs) ? baseFilter : { ...baseFilter, Lead_Owner: agentName };
      const sqlLeadsData = await col.find({
        ...filter,
        SQL_Date: {
          $gte: filterStart,
          $lte: filterEnd,
        },
      }).sort({ SQL_Date: -1 }).toArray();

      prospectorLeads = sqlLeadsData.map(l => ({
        _id: l._id,
        enquiryCode: l['Enquiry Code'],
        clientCompanyName: l['Client_Company_Name'],
        leadOwner: l['Lead_Owner'],
        sqlDate: l['SQL_Date'],
        poDate: l['PO_Date'],
      }));

      // Get incentives for these leads
      const prospectorEnquiryCodes = prospectorLeads.map(l => l.enquiryCode);
      if (prospectorEnquiryCodes.length > 0) {
        prospectorIncentives = await IncentiveLedger.find({
          userId: (isAdmin && !viewAs) ? { $exists: true } : userId,
          enquiryCode: { $in: prospectorEnquiryCodes },
          incentiveType: { $in: ['SQL', 'PO_CONVERSION'] },
          status: { $ne: 'Reversed' },
          ...getIncentiveDateFilter(),
        }).sort({ createdAt: -1 });

        // If viewing a specific user, filter to only that user's incentives
        if (viewAs) {
          prospectorIncentives = prospectorIncentives.filter(inc => inc.userId.toString() === userId.toString());
        }
      }
    }

    // Step 10: Get pending approvals (for Admin role)
    let pendingApprovals = [];
    if (role === 'admin') {
      pendingApprovals = await IncentiveLedger.find({
        status: { $ne: 'Reversed' },
        $or: [
          { adminApproved: false },
          { ceoApproved: false },
        ],
        ...getIncentiveDateFilter(),
      })
        .populate('userId', 'agentName')
        .sort({ createdAt: -1 })
        .limit(50); // Limit to recent 50

      // Get lead details for pending approvals
      const pendingEnquiryCodes = pendingApprovals.map(inc => inc.enquiryCode);
      const pendingLeads = await col.find({
        'Enquiry Code': { $in: pendingEnquiryCodes },
      }).toArray();

      const pendingLeadMap = {};
      pendingLeads.forEach(l => {
        pendingLeadMap[l['Enquiry Code']] = {
          status: l['Status'],
          clientCompanyName: l['Client_Company_Name'],
        };
      });

      pendingApprovals = pendingApprovals.map(inc => ({
        ...inc.toObject(),
        lead: pendingLeadMap[inc.enquiryCode] || {},
      }));
    }

    res.json({
      success: true,
      quarter,
      target_potential,
      earned,
      pending,
      remaining,
      achievement_percentage: Math.round(achievement_percentage * 10) / 10,
      total_entries,
      sql_target: shouldTreatAsSQLClosure ? 0 : sql_target, // Ensure SQL Closure team members see 0
      closure_target,
      po_target,
      incentive_per_po,
      incentive_per_sql,
      po_potential,
      sql_potential: shouldTreatAsSQLClosure ? 0 : sql_potential, // Ensure SQL Closure team members see 0
      po_incentives: poIncentives,
      sql_leads: sqlLeads,
      prospector_leads: prospectorLeads,
      prospector_incentives: prospectorIncentives,
      pending_approvals: pendingApprovals,
      monthly_breakdown,
      // Include viewAs user info if viewing another user
      viewAsUser: viewAsUser ? {
        _id: viewAsUser._id,
        agentName: viewAsUser.agentName,
        username: viewAsUser.username,
        incentive_role: viewAsUser.incentive_role,
      } : null,
    });
  } catch (error) {
    console.error('Quarterly dashboard error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
