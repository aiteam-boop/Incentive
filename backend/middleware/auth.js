const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verify JWT token and attach user to request.
 * Uses existing 'users' collection — no separate auth table.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // User must have an incentive_role to access the incentive system
    if (!user.incentive_role) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to the Incentive System. Contact an admin.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/**
 * Role-based authorization using incentive_role field.
 * Roles: 'admin', 'sql_closure', 'prospector'
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.incentive_role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.incentive_role}' is not authorized to access this resource`,
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
