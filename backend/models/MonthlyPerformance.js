const mongoose = require('mongoose');

const monthlyPerformanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    month: { type: String, required: true }, // Format: YYYY-MM
    sqlClosedCount: { type: Number, default: 0 },
    poCount: { type: Number, default: 0 },
    sqlMilestoneBonusPaid: { type: Boolean, default: false },
    poMilestoneBonusPaid: { type: Boolean, default: false },
    totalEarnings: { type: Number, default: 0 },
    totalBonuses: { type: Number, default: 0 },
  },
  { timestamps: true }
);

monthlyPerformanceSchema.index({ userId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyPerformance', monthlyPerformanceSchema, 'incentive_monthly_performance');
