const express = require('express');
const mongoose = require('mongoose');
const IncentiveLedger = require('../models/IncentiveLedger');
const MonthlyPerformance = require('../models/MonthlyPerformance');
const Target = require('../models/Target');
const TeamTarget = require('../models/TeamTarget');
const User = require('../models/User');
const { getOperationsDb } = require('../config/mongo');
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

    // Step 1: Get target for this period
    // Priority 1: Check individual 'targets' collection (Lead_Owner key)
    const altTargetsCollection = mongoose.connection.db.collection('targets');
    const altTarget = await altTargetsCollection.findOne({ Lead_Owner: agentName });

    let sql_target = 0;
    let closure_target = 0;
    let po_target = 0;
    let monthly_price = 0;
    let target_potential = 0;
    let incentive_per_po = 1000;
    let incentive_per_sql = 300;

    if (altTarget) {
      // Extract values from root document which ALWAYS represents the source of truth
      const rawSql = altTarget['Monthly Sql Target'] ?? 0;
      const rawPo = altTarget['Monthly Po Target'] ?? 0;
      monthly_price = altTarget['Monthly Price'] ?? 0;
      
      // If viewing the full quarter (no month filter), we scale by 3.
      const multiplier = month ? 1 : 3;
      
      sql_target = rawSql * multiplier;
      po_target = rawPo * multiplier;
      closure_target = po_target;
      
      target_potential = (rawPo * monthly_price) * multiplier;
      incentive_per_po = monthly_price; 
      incentive_per_sql = 300; 
    } else {
      // Fallback 1: Strongly-typed Target model (quarter-based)
      let targetDoc = await Target.findOne({ user_id: userId, quarter });
      if (targetDoc) {
        sql_target = targetDoc.sql_target || 0;
        po_target = targetDoc.po_target || 0;
        closure_target = targetDoc.closure_target || po_target;
        target_potential = targetDoc.total_incentive_target || (po_target * (targetDoc.incentive_per_po || 1000));
        incentive_per_po = targetDoc.incentive_per_po || 1000;
      } else {
        // Fallback 2: TeamTarget (monthly based, scale to quarter if needed)
        const TeamTarget = require('../models/TeamTarget');
        let teamTarget = await TeamTarget.findOne({ team: role });
        if (teamTarget) {
          const multiplier = month ? 1 : 3;
          sql_target = (teamTarget.sql_target || 0) * multiplier;
          po_target = (teamTarget.po_target || 0) * multiplier;
          closure_target = po_target;
          monthly_price = teamTarget.price_target || 0;
          target_potential = (po_target * monthly_price);
          incentive_per_po = monthly_price;
        }
      }
    }
    // Calculate breakdown for response
    // 1. PO Potential: for inbound/outbound, this is 0 (as per requested logic: only SQL counts)
    const isProspectingRole = (role === 'inbound' || role === 'outbound' || role === 'prospector');
    const po_potential = isProspectingRole ? 0 : (po_target * incentive_per_po);
    
    // 2. SQL Potential: previously was 0 for closure, now everyone gets it if target > 0
    const sql_potential = (sql_target * incentive_per_sql);
    
    // Always recalculate target_potential based on the final components to ensure consistency
    target_potential = po_potential + sql_potential;

    // Adjust display values for Inbound/Outbound (Hide PO target row by setting to 0)
    if (isProspectingRole) {
      po_target = 0;
    }

    // Adjust display values for SQL Closure: show both, but the user specifically asked 
    // to show SQl target even for closure team. So we no longer set sql_target to 0 here.

    // Step 2: Get earned incentives (quarterly & filtered)
    // ... rest of the logic remains relative to the period


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
    const getLeadsMaster = () => mongoose.connection.db.collection('leads_master');
    const col = getLeadsMaster();

    // Step 7: Get PO incentives table data (for ALL roles so every agent sees their POs)
    let poIncentives = [];
    if (true) { // removed constraint so Sapna/Aparna can see theirs too
      const targetIsCEO = (viewAsUser?.agentName || agentName || '').toLowerCase().includes('ceo');

      // Get PO leads within quarter date range
      // If viewing a specific user, filter by their agentName
      // EXCEPT if that user is the CEO, then show everything (team view)
      const poLeadsFilter = (isAdmin && (!viewAs || targetIsCEO))
        ? {}
        : { $or: [{ Lead_Owner: agentName }, { Sales_Owner: agentName }] };

      console.log(`[DEBUG] Fetching PO leads for ${agentName} in range ${filterStart.toISOString()} - ${filterEnd.toISOString()}`);
      console.log(`[DEBUG] Filter:`, JSON.stringify(poLeadsFilter));
      
      let poLeads = await col.find({
        ...poLeadsFilter,
        PO_Date: {
          $gte: filterStart,
          $lte: filterEnd,
        },
        Status: 'PO'
      }).sort({ PO_Date: -1 }).toArray();

      console.log(`[DEBUG] Found ${poLeads.length} PO leads`);
      if (poLeads.length > 0) {
        console.log(`[DEBUG] First lead: ${poLeads[0]['Enquiry Code']} - ${poLeads[0].Lead_Owner}`);
      }

      // Get incentives for these leads
      const enquiryCodes = poLeads.map(l => l['Enquiry Code']);

      // --- MANUAL CROSS-DATABASE JOIN FOR STAGE 1 & 6 (Operations data) ---
      try {
        const opsDb = await getOperationsDb();
        const enquiryCodesForOps = poLeads.map(l => l['Enquiry Code']).filter(Boolean);

        // Fetch stage1_data
        const stage1Docs = await opsDb.collection('stage1_data').find({
          'Sales Enquiry Code': { $in: enquiryCodesForOps }
        }).project({ 'Sales Enquiry Code': 1, 'Order Received Number': 1 }).toArray();

        const orderNoMapByEnquiry = {};
        const orderNumbers = [];
        stage1Docs.forEach(d => {
          const eq = d['Sales Enquiry Code'];
          const orderNo = d['Order Received Number'];
          if (eq && orderNo) {
            orderNoMapByEnquiry[eq] = orderNo;
            orderNumbers.push(orderNo);
          }
        });

        // Fetch stage6_data
        const stage6Docs = await opsDb.collection('stage6_data').find({
          'Order Received Number': { $in: orderNumbers }
        }).project({ 'Order Received Number': 1, 'PI_number': 1 }).toArray();

        const piMapByOrderNo = {};
        stage6Docs.forEach(d => {
          const orderNo = d['Order Received Number'];
          const piNumber = d['PI_number'];
          if (orderNo && piNumber) piMapByOrderNo[orderNo] = piNumber;
        });

        // Attach to leads
        poLeads = poLeads.map(l => {
          const eqCode = l['Enquiry Code'];
          const orderRecvNo = orderNoMapByEnquiry[eqCode];
          const piNum = orderRecvNo ? piMapByOrderNo[orderRecvNo] : null;
          return {
            ...l,
            orderReceivedNumber: orderRecvNo || 'Not Available',
            piNumber: piNum || 'Not Available'
          };
        });
      } catch (opsErr) {
        console.error('Failed to fetch operations data for PO leads:', opsErr.message);
      }
      // --- END MANUAL JOIN ---

      // Build query for PO incentives
      let incentiveQuery = {
        incentiveType: 'CLOSURE',
        status: { $ne: 'Reversed' },
        ...getIncentiveDateFilter(),
      };

      // If admin viewing own dashboard, get all PO incentives (will include Pushpalata's own)
      // If viewing specific user, get only that user's incentives
      // Otherwise, get incentives matching the PO leads enquiry codes
      if (isAdmin && (!viewAs || targetIsCEO)) {
        // Admin viewing own dashboard OR viewing CEO dashboard: get all PO incentives
        // This includes all team members' incentives
        incentiveQuery.userId = { $exists: true };
      } else if (viewAs) {
        // Viewing specific non-CEO user: get only their incentives
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

      // --- MANUAL CROSS-DATABASE JOIN FOR STAGE 1 & 6 ---
      // Extract enquiry codes from leads
      const allPoEnquiryCodes = poLeads.map(l => l['Enquiry Code']).filter(Boolean);

      const opsDb = await getOperationsDb();

      const stage1Docs = await opsDb.collection('stage1_data').find({
        'Sales Enquiry Code': { $in: allPoEnquiryCodes }
      }).project({ 'Sales Enquiry Code': 1, 'Order Received Number': 1 }).toArray();

      const orderNoMapByEnquiry = {};
      const orderNumbers = [];
      stage1Docs.forEach(d => {
        const eq = d['Sales Enquiry Code'];
        const orderNo = d['Order Received Number'];
        if (eq && orderNo) {
          orderNoMapByEnquiry[eq] = orderNo;
          orderNumbers.push(orderNo);
        }
      });

      const stage6Docs = await opsDb.collection('stage6_data').find({
        'Order Received Number': { $in: orderNumbers }
      }).project({ 'Order Received Number': 1, 'PI_number': 1 }).toArray();

      const piMapByOrderNo = {};
      stage6Docs.forEach(d => {
        const orderNo = d['Order Received Number'];
        const piNumber = d['PI_number'];
        if (orderNo && piNumber) {
          piMapByOrderNo[orderNo] = piNumber;
        }
      });

      // Map back
      poLeads = poLeads.map(l => {
        const eqCode = l['Enquiry Code'];
        const orderRecvNo = orderNoMapByEnquiry[eqCode];
        const piNum = orderRecvNo ? piMapByOrderNo[orderRecvNo] : null;
        return {
          ...l,
          orderReceivedNumber: orderRecvNo || 'Not Available',
          piNumber: piNum || 'Not Available'
        };
      });
      // --- END MANUAL JOIN ---

      if (isAdmin && targetIsCEO) {
        // CEO dashboard view: show ALL team members but hide CEO's own (they don't get incentives)
        poIncentiveRecords = poIncentiveRecords.filter(inc => !(inc.agentName || '').toLowerCase().includes('ceo'));
      } else if (viewAs) {
        // When viewing a specific non-CEO user, filter to only that user's incentives
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
          industry: l['Industry'],
          clientPersonName: l['Client_Person_Name'],
          orderReceivedNumber: l.orderReceivedNumber,
          piNumber: l.piNumber,
        };
      });

      poIncentives = poLeads.map(l => {
        const leadEnquiryCode = l['Enquiry Code'];
        const inc = poIncentiveRecords.find(i => i.enquiryCode === leadEnquiryCode);
        const mappedLead = leadMap[leadEnquiryCode] || {};
        return {
          ...(inc?.toObject ? inc.toObject() : inc || {}),
          enquiryCode: leadEnquiryCode,
          agentName: l['Lead_Owner'] || l['Sales_Owner'] || 'Unknown',
          clientCompanyName: l['Client_Company_Name'],
          amount: inc ? inc.amount : 1000,
          incentiveType: 'CLOSURE',
          status: inc ? inc.status : 'Pending',
          adminApproved: inc ? inc.adminApproved : false,
          ceoApproved: inc ? inc.ceoApproved : false,
          lead: {
            ...l, // keep raw for safety
            ...mappedLead // override with mapped camelCase fields
          }
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
