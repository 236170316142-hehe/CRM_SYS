const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  value: {
    type: Number,
    required: true,
    default: 0,
  },
  stage: {
    type: String,
    enum: ['prospect', 'proposal', 'negotiation', 'closed-won', 'closed-lost'],
    default: 'prospect',
  },
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
  },
  stageHistory: [{
    stage: String,
    changedAt: {
      type: Date,
      default: Date.now,
    }
  }],
  isStale: {
    type: Boolean,
    default: false,
  },
  // Proposal / quote tracking
  proposalStatus: {
    type: String,
    enum: ['none', 'generating', 'sent', 'viewed', 'signed', 'declined'],
    default: 'none',
  },
  proposalSentAt: { type: Date },
  pandaDocId:     { type: String },   // PandaDoc document ID if used
  proposalUrl:    { type: String },   // PandaDoc shareable link or internal download path
}, {
  timestamps: true,
});

const Deal = mongoose.model('Deal', dealSchema);

module.exports = Deal;
