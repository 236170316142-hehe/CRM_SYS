const mongoose = require('mongoose');
const crypto = require('crypto');

const pendingLeadSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  email:     { type: String, required: true },
  phone:     { type: String },
  company:   { type: String },
  territory: { type: String },
  source:    { type: String, default: 'web' },
  message:   { type: String },

  token: {
    type: String,
    required: true,
    default: () => crypto.randomBytes(32).toString('hex'),
  },

  // Auto-delete after 1 hour whether verified or not
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 60 * 60 * 1000),
    index: { expires: 0 }, // TTL index — MongoDB removes docs automatically
  },

  verified: { type: Boolean, default: false },
}, { timestamps: true });

// Ensure one pending record per email (replace on re-submit)
pendingLeadSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('PendingLead', pendingLeadSchema);
