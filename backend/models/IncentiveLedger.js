const mongoose = require('mongoose');

/**
 * IncentiveLedger — tracks each incentive entry with dual approval (Admin + CEO).
 * 
 * incentiveType:
 *   - SQL: Prospector gets ₹300 when SQL is verified
 *   - PO_CONVERSION: Prospector gets ₹200 when their SQL lead converts to PO
 *   - CLOSURE: SQL Closure team gets ₹1000 per PO
 *   - Bonus_SQL_Milestone: SQL Closure bonus for ≥10 SQLs closed
 *   - Bonus_PO_Milestone: SQL Closure bonus for ≥25 POs
 */
const incentiveLedgerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    agentName: { type: String, required: true }, // Denormalized for display
    enquiryCode: { type: String, required: true }, // Links to leads_master "Enquiry Code"
    leadMasterId: { type: mongoose.Schema.Types.ObjectId }, // Optional ref to leads_master _id
    clientCompanyName: { type: String },
    incentiveType: {
      type: String,
      enum: ['SQL', 'PO_CONVERSION', 'CLOSURE', 'Bonus_SQL_Milestone', 'Bonus_PO_Milestone'],
      required: true,
    },
    amount: { type: Number, required: true },
    month: { type: String, required: true }, // Format: YYYY-MM

    // Dual approval system
    adminApproved: { type: Boolean, default: false },
    adminApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminApprovedAt: { type: Date },
    ceoApproved: { type: Boolean, default: false },
    ceoApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ceoApprovedAt: { type: Date },

    // Status derived from approvals
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Paid', 'Reversed'],
      default: 'Pending',
    },

    description: { type: String },
    reversedAt: { type: Date },
    reversalReason: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
incentiveLedgerSchema.index({ userId: 1, month: 1 });
incentiveLedgerSchema.index({ enquiryCode: 1, incentiveType: 1, userId: 1 }, { unique: true });
incentiveLedgerSchema.index({ agentName: 1 });
incentiveLedgerSchema.index({ status: 1 });

module.exports = mongoose.model('IncentiveLedger', incentiveLedgerSchema, 'incentive_ledger');
