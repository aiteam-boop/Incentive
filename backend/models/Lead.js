const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    // Lead basic info
    leadName: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    contactEmail: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    source: { type: String, trim: true },

    // Stage tracking
    stage: {
      type: String,
      enum: ['Prospect', 'SQL', 'Closed', 'PO_Generated', 'Rejected'],
      default: 'Prospect',
    },

    // Prospector info
    createdByProspector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // SQL verification
    sqlMarkedDate: { type: Date },
    sqlVerified: { type: Boolean, default: false },
    sqlVerifiedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sqlVerifiedByCEO: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sqlVerifiedDate: { type: Date },

    // Closure tracking
    assignedSqlCloser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closureDate: { type: Date },
    closureVerified: { type: Boolean, default: false },
    closureVerifiedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closureVerifiedByCEO: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closureVerifiedDate: { type: Date },

    // PO tracking
    poGenerated: { type: Boolean, default: false },
    poGeneratedDate: { type: Date },
    poNumber: { type: String, trim: true },
    poCancelled: { type: Boolean, default: false },

    // Deal value
    dealValue: { type: Number, default: 0 },

    // Notes
    notes: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

// Indexes for fast queries
leadSchema.index({ stage: 1 });
leadSchema.index({ createdByProspector: 1 });
leadSchema.index({ assignedSqlCloser: 1 });
leadSchema.index({ sqlVerified: 1 });
leadSchema.index({ closureVerified: 1 });

module.exports = mongoose.model('Lead', leadSchema, 'incentive_leads');
