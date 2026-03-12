const mongoose = require('mongoose');

const teamTargetSchema = new mongoose.Schema(
  {
    team: { 
      type: String, 
      required: true, 
      unique: true,
      enum: ['inbound', 'outbound', 'sql_closure']
    },
    po_target: { type: Number, default: 0 },
    sql_target: { type: Number, default: 0 },
    price_target: { type: Number, default: 0 },
    updatedBy: { type: String },
    history: [
      {
        po_target: Number,
        sql_target: Number,
        price_target: Number,
        updatedAt: { type: Date, default: Date.now },
        updatedBy: String
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('TeamTarget', teamTargetSchema, 'team_targets');
