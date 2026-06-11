const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  externalId: {
    type: String,
    unique: true,
    sparse: true, // allows null for manually created tickets
  },
  source: {
    type: String,
    enum: ['zendesk', 'freshdesk', 'manual'],
    default: 'manual',
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
  description: {
    type: String,
    default: '',
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  status: {
    type: String,
    enum: ['open', 'pending', 'solved', 'closed'],
    default: 'open',
  },
  externalCreatedAt: {
    type: Date,
  },
  externalUrl: {
    type: String, // link back to Zendesk/Freshdesk ticket
  },
}, {
  timestamps: true,
});

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

module.exports = SupportTicket;
