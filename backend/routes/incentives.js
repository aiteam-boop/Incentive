const express = require('express');
const IncentiveLedger = require('../models/IncentiveLedger');
const MonthlyPerformance = require('../models/MonthlyPerformance');
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

module.exports = router;
