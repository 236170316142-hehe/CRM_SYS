const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true,
  },
  deal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal',
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: true,
  },
  value: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['active', 'renewed', 'churned', 'expired'],
    default: 'active',
  },
  // Track which reminder milestones have been sent to prevent duplicates
  remindersSent: {
    type: [Number],  // e.g. [90, 60] means 90-day and 60-day reminders sent
    default: [],
  },
  notes: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

const Contract = mongoose.model('Contract', contractSchema);

module.exports = Contract;
