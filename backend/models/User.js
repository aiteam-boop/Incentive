const mongoose = require('mongoose');

/**
 * User model — connects to the EXISTING 'users' collection in sales_crm database.
 * No separate incentive users. Uses existing login credentials.
 * Adds 'incentive_role' field for incentive system access control.
 */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    agentName: { type: String, trim: true },
    role: { type: String }, // Existing role: 'admin' / 'agent'
    password: { type: String, required: true }, // Existing plain-text passwords
    email: { type: String, trim: true },

    // Incentive system role — added by our system
    incentive_role: {
      type: String,
      enum: ['admin', 'sql_closure', 'prospector', null],
      default: null,
    },
  },
  {
    timestamps: true,
    strict: false, // Allow other fields that may exist in the collection
  }
);

// Compare password — existing system uses plain text passwords
userSchema.methods.comparePassword = function (candidatePassword) {
  return this.password === candidatePassword;
};

// Safe JSON — exclude password from API responses
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Connect to EXISTING 'users' collection (third param forces collection name)
module.exports = mongoose.model('User', userSchema, 'users');
