const mongoose = require('mongoose');

/**
 * Target — stores quarterly targets for users
 * 
 * quarter format: "2026-Q1", "2026-Q2", etc.
 */
const targetSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quarter: { type: String, required: true }, // Format: "YYYY-Q1", "YYYY-Q2", etc.
    sql_target: { type: Number, default: 0 },
    closure_target: { type: Number, default: 0 },
    po_target: { type: Number, default: 0 },
    total_incentive_target: { type: Number, required: true },
    incentive_per_po: { type: Number, default: 1000 }, // Incentive amount per PO
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
targetSchema.index({ user_id: 1, quarter: 1 }, { unique: true });
targetSchema.index({ quarter: 1 });

module.exports = mongoose.model('Target', targetSchema, 'targets');

