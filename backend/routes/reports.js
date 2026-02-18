const express = require('express');
const IncentiveLedger = require('../models/IncentiveLedger');
const MonthlyPerformance = require('../models/MonthlyPerformance');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/team-incentives - Team-wise Incentive Report (Admin only)
router.get('/team-incentives', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { month, startDate, endDate } = req.query;
    const match = { status: { $ne: 'Reversed' } };

    if (month) {
      match.month = month;
    } else if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const report = await IncentiveLedger.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $group: {
          _id: { role: '$user.incentive_role', incentiveType: '$incentiveType' },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          pendingAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, '$amount', 0] },
          },
          approvedAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, '$amount', 0] },
          },
          paidAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$amount', 0] },
          },
        },
      },
      {
        $group: {
          _id: '$_id.role',
          incentiveTypes: {
            $push: {
              type: '$_id.incentiveType',
              totalAmount: '$totalAmount',
              count: '$count',
              pendingAmount: '$pendingAmount',
              approvedAmount: '$approvedAmount',
              paidAmount: '$paidAmount',
            },
          },
          grandTotal: { $sum: '$totalAmount' },
        },
      },
    ]);

    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/monthly-bonus - Monthly Bonus Report (Admin only)
router.get('/monthly-bonus', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { month } = req.query;
    const filter = {};
    if (month) filter.month = month;

    const performances = await MonthlyPerformance.find(filter)
      .populate('userId', 'agentName username incentive_role')
      .sort({ totalBonuses: -1 });

    const summary = {
      totalSqlMilestones: 0,
      totalPoMilestones: 0,
      totalBonusesPaid: 0,
    };

    performances.forEach((p) => {
      if (p.sqlMilestoneBonusPaid) summary.totalSqlMilestones++;
      if (p.poMilestoneBonusPaid) summary.totalPoMilestones++;
      summary.totalBonusesPaid += p.totalBonuses;
    });

    res.json({ success: true, performances, summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/lead-conversion - Lead Stage Conversion Report (Admin only)
router.get('/lead-conversion', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = {};

    if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const stageBreakdown = await Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$stage',
          count: { $sum: 1 },
          totalDealValue: { $sum: '$dealValue' },
        },
      },
    ]);

    const total = stageBreakdown.reduce((sum, s) => sum + s.count, 0);
    const conversionReport = stageBreakdown.map((s) => ({
      stage: s._id,
      count: s.count,
      totalDealValue: s.totalDealValue,
      percentage: total > 0 ? ((s.count / total) * 100).toFixed(2) : 0,
    }));

    // Monthly trend
    const monthlyTrend = await Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            stage: '$stage',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.month': -1 } },
    ]);

    res.json({ success: true, stageBreakdown: conversionReport, monthlyTrend, totalLeads: total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/incentive-audit - Incentive Audit Trail (Admin only)
router.get('/incentive-audit', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 100, userId, month } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (month) filter.month = month;

    const ledgerEntries = await IncentiveLedger.find(filter)
      .populate('userId', 'agentName username incentive_role')
      .populate('leadId', 'leadName company stage')
      .populate('approvedBy', 'agentName username')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await IncentiveLedger.countDocuments(filter);

    const summary = await IncentiveLedger.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      entries: ledgerEntries,
      summary,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/user-performance/:userId - Individual user performance
router.get('/user-performance/:userId', authenticate, async (req, res) => {
  try {
    const role = req.user.incentive_role;
    // Users can view own, admins can view anyone
    if (role !== 'admin' && req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Filter incentives based on the target user's role
    let typeFilter = {};
    if (user.incentive_role === 'prospector') {
      typeFilter = { incentiveType: 'SQL' };
    } else if (user.incentive_role === 'sql_closure') {
      typeFilter = { incentiveType: { $in: ['Closure', 'Bonus_SQL_Milestone', 'Bonus_PO_Milestone'] } };
    }

    const incentives = await IncentiveLedger.find({ userId: req.params.userId, ...typeFilter })
      .populate('leadId', 'leadName company stage')
      .sort({ createdAt: -1 });

    const monthlyPerf = await MonthlyPerformance.find({ userId: req.params.userId })
      .sort({ month: -1 });

    const lifetimeStats = await IncentiveLedger.aggregate([
      { $match: { userId: user._id, status: { $ne: 'Reversed' }, ...typeFilter } },
      {
        $group: {
          _id: '$incentiveType',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      user,
      incentives,
      monthlyPerformance: monthlyPerf,
      lifetimeStats,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
