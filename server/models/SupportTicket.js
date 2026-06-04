const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  externalId: {
    type: String, // Zendesk ticket ID
    required: true,
    unique: true,
  },
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  status: {
    type: String,
    enum: ['open', 'pending', 'solved'],
    default: 'open',
  },
}, {
  timestamps: true,
});

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

module.exports = SupportTicket;
