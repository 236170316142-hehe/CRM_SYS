const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
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
  endDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'renewed', 'churned'],
    default: 'active',
  },
}, {
  timestamps: true,
});

const Contract = mongoose.model('Contract', contractSchema);

module.exports = Contract;
