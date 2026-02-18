const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Uses existing Sales Dashboard credentials: username + password (plain text)
 * Only users with an incentive_role can access the system.
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    // Find user in existing 'users' collection
    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password (existing system uses plain text)
    const isMatch = user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if user has incentive system access
    if (!user.incentive_role) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to the Incentive System. Contact an admin.',
      });
    }

    const token = jwt.sign(
      { userId: user._id, incentive_role: user.incentive_role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user.
 */
router.get('/me', authenticate, async (req, res) => {
  res.json({ success: true, user: req.user });
});

/**
 * GET /api/auth/users
 * Admin only — list all users with incentive roles.
 */
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ incentive_role: 1, agentName: 1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/auth/users/:id/role
 * Admin only — assign/change a user's incentive_role.
 * This is how new team members get access.
 */
router.put('/users/:id/role', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { incentive_role } = req.body;

    if (incentive_role && !['admin', 'sql_closure', 'prospector'].includes(incentive_role)) {
      return res.status(400).json({ success: false, message: 'Invalid incentive role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { incentive_role: incentive_role || null },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user, message: `Role updated to '${incentive_role || 'none'}'` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
