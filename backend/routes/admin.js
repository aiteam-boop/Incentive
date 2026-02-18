const express = require('express');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Default settings values
const DEFAULTS = {
  sql_incentive_rate: 300,
  sql_incentive_cap: 500,
  closure_incentive_rate: 1000,
  closure_incentive_cap: 1000,
  po_conversion_bonus: 200,
  bonus_sql_threshold: 10,
  bonus_sql_amount: 10000,
  bonus_po_threshold: 25,
  bonus_po_amount: 50000,
};

// GET /api/admin/settings
router.get('/settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const settings = await Settings.find({}).populate('updatedBy', 'agentName username');
    const result = {};
    Object.keys(DEFAULTS).forEach((key) => {
      const saved = settings.find((s) => s.key === key);
      result[key] = {
        key,
        value: saved ? saved.value : DEFAULTS[key],
        default: DEFAULTS[key],
        description: saved ? saved.description : '',
        updatedBy: saved ? saved.updatedBy : null,
        updatedAt: saved ? saved.updatedAt : null,
      };
    });
    res.json({ success: true, settings: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/admin/settings
router.put('/settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { key, value, description } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ success: false, message: 'Key and value are required' });
    }

    // Validate hard caps
    if (key === 'sql_incentive_rate' && value > DEFAULTS.sql_incentive_cap) {
      return res.status(400).json({ success: false, message: `SQL rate cannot exceed ₹${DEFAULTS.sql_incentive_cap}` });
    }
    if (key === 'closure_incentive_rate' && value > DEFAULTS.closure_incentive_cap) {
      return res.status(400).json({ success: false, message: `Closure rate cannot exceed ₹${DEFAULTS.closure_incentive_cap}` });
    }

    const oldSetting = await Settings.findOne({ key });
    const oldValue = oldSetting ? oldSetting.value : DEFAULTS[key];

    const setting = await Settings.findOneAndUpdate(
      { key },
      { value, description, updatedBy: req.user._id },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      userId: req.user._id,
      action: 'SETTING_CHANGED',
      entity: 'Settings',
      entityId: setting._id,
      details: { key, oldValue, newValue: value },
    });

    res.json({ success: true, setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, action } = req.query;
    const filter = {};
    if (action) filter.action = action;

    const logs = await AuditLog.find(filter)
      .populate('userId', 'agentName username incentive_role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(filter);
    res.json({ success: true, logs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { incentive_role } = req.body;
    if (incentive_role && !['admin', 'sql_closure', 'prospector'].includes(incentive_role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { incentive_role: incentive_role || null },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await AuditLog.create({
      userId: req.user._id,
      action: 'USER_ROLE_CHANGED',
      entity: 'User',
      entityId: user._id,
      details: { agentName: user.agentName, newRole: incentive_role },
    });

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
