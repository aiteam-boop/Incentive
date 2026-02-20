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

/**
 * POST /api/auth/sso-login
 * SSO login endpoint for Sales OS integration.
 * Accepts a JWT token from Sales OS and automatically logs the user in.
 * 
 * Token should contain:
 * - userId (MongoDB ObjectId) OR email
 * - incentive_role (optional, will be fetched from user if not provided)
 * 
 * Uses JWT_SECRET or SSO_SECRET (if configured) to verify token.
 */
router.post('/sso-login', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    // Verify token - use SSO_SECRET if configured, otherwise use JWT_SECRET
    const secret = process.env.SSO_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: 'SSO configuration error' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Find user by userId or email
    let user;
    if (decoded.userId) {
      user = await User.findById(decoded.userId);
    } else if (decoded.email) {
      user = await User.findOne({ email: decoded.email });
    } else if (decoded.username) {
      user = await User.findOne({ username: decoded.username.toLowerCase().trim() });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user has incentive system access
    if (!user.incentive_role) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to the Incentive System. Contact an admin.',
      });
    }

    // Generate new incentive system token
    const incentiveToken = jwt.sign(
      { userId: user._id, incentive_role: user.incentive_role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token: incentiveToken,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('SSO login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
