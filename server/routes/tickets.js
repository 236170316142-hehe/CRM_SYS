const express = require('express');
const SupportTicket = require('../models/SupportTicket');
const Contact       = require('../models/Contact');
const Lead          = require('../models/Lead');
const { protect }   = require('../middleware/authMiddleware');
const { sendSlackNotification, sendEmailNotification } = require('../services/notifyService');
const { sanitizePhone } = require('../utils/sanitize');

const router = express.Router();
router.use(protect);

// ── Helper — sync open ticket count back to Contact ───────────────────────
async function syncTicketCount(contactId) {
  const count = await SupportTicket.countDocuments({
    contact: contactId,
    status: { $in: ['open', 'pending'] },
  });
  await Contact.findByIdAndUpdate(contactId, { openTicketCount: count });
  return count;
}

// ── Helper — alert sales rep when high/urgent ticket arrives ──────────────
async function alertRepForCriticalTicket(ticket, contact) {
  if (!['high', 'urgent'].includes(ticket.priority)) return;

  const Deal = require('../models/Deal');
  const deal = await Deal.findOne({ contact: contact._id })
    .populate('assignedTo', 'name email')
    .sort({ createdAt: -1 });

  if (!deal?.assignedTo?.email) return;

  const priorityLabel = ticket.priority === 'urgent' ? '🚨 URGENT' : '⚠️ HIGH';

  await sendSlackNotification(
    `${priorityLabel} Support Ticket | Customer: *${contact.name}* | Subject: "${ticket.subject}" | Status: ${ticket.status} | Source: ${ticket.source}`
  );

  await sendEmailNotification(
    deal.assignedTo.email,
    `${priorityLabel} Ticket: ${contact.name} — "${ticket.subject}"`,
    `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="background:#161b22;border-radius:12px 12px 0 0;padding:24px 36px;border-bottom:3px solid ${ticket.priority === 'urgent' ? '#ef4444' : '#f59e0b'};">
    <span style="font-size:18px;font-weight:800;color:${ticket.priority === 'urgent' ? '#ef4444' : '#f59e0b'};">⚡ Teamgrid CRM</span>
    <span style="font-size:13px;color:#8b949e;margin-left:12px;">${priorityLabel} Ticket Alert</span>
  </td></tr>
  <tr><td style="background:#161b22;padding:32px 36px;">
    <h2 style="margin:0 0 16px;font-size:18px;font-weight:800;color:#e6edf3;">
      ${priorityLabel} Support Ticket — Action Needed
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#8b949e;line-height:1.7;">
      Hi ${deal.assignedTo.name}, your customer <strong style="color:#e6edf3;">${contact.name}</strong> has a ${ticket.priority} priority support ticket. 
      Do not call or email them about other matters until this is resolved.
    </p>
    <table width="100%" cellpadding="12" cellspacing="0"
           style="background:#1c2330;border:1px solid rgba(${ticket.priority === 'urgent' ? '239,68,68' : '245,158,11'},0.2);border-radius:10px;margin-bottom:24px;">
      <tr><td style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Customer</div>
        <div style="font-size:15px;font-weight:700;color:#e6edf3;">${contact.name}</div>
        <div style="font-size:13px;color:#8b949e;">${contact.email}</div>
      </td></tr>
      <tr><td style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Ticket Subject</div>
        <div style="font-size:15px;color:#c9d1d9;">${ticket.subject}</div>
      </td></tr>
      <tr><td style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Priority</div>
        <div style="font-size:15px;font-weight:700;color:${ticket.priority === 'urgent' ? '#ef4444' : '#f59e0b'};">${ticket.priority.toUpperCase()}</div>
      </td></tr>
      <tr><td>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Source</div>
        <div style="font-size:15px;color:#c9d1d9;">${ticket.source}</div>
      </td></tr>
    </table>
    ${ticket.externalUrl ? `<a href="${ticket.externalUrl}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;">View Ticket →</a>` : ''}
  </td></tr>
  <tr><td style="background:#0d1117;border-radius:0 0 12px 12px;padding:16px 36px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
    <p style="margin:0;font-size:11px;color:#4a5568;">© 2026 Teamgrid CRM</p>
  </td></tr>
</table></td></tr></table>
</body></html>`
  );
}

// @desc    Get all tickets
// @route   GET /api/tickets
// @access  Private
router.get('/', async (req, res, next) => {
  try {
    const query = {};
    if (req.query.contactId) query.contact = req.query.contactId;
    if (req.query.status)    query.status   = req.query.status;
    if (req.query.priority)  query.priority  = req.query.priority;

    const tickets = await SupportTicket.find(query)
      .populate('contact', 'name email company')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) { next(error); }
});

// @desc    Create a ticket manually
// @route   POST /api/tickets
// @access  Private
router.post('/', async (req, res, next) => {
  try {
    const { contactId, subject, description, priority, status } = req.body;
    if (!contactId || !subject) {
      res.status(400); throw new Error('contactId and subject are required');
    }

    const contact = await Contact.findById(contactId);
    if (!contact) { res.status(404); throw new Error('Contact not found'); }

    const ticket = await SupportTicket.create({
      contact: contactId,
      subject,
      description: description || '',
      priority:    priority    || 'normal',
      status:      status      || 'open',
      source:      'manual',
    });

    await syncTicketCount(contactId);
    await alertRepForCriticalTicket(ticket, contact);

    const populated = await ticket.populate('contact', 'name email company');
    res.status(201).json(populated);
  } catch (error) { next(error); }
});

// @desc    Update a ticket
// @route   PUT /api/tickets/:id
// @access  Private
router.put('/:id', async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('contact', 'name email company');
    if (!ticket) { res.status(404); throw new Error('Ticket not found'); }

    await syncTicketCount(ticket.contact._id);
    res.json(ticket);
  } catch (error) { next(error); }
});

// @desc    Delete a ticket
// @route   DELETE /api/tickets/:id
// @access  Private
router.delete('/:id', async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findByIdAndDelete(req.params.id);
    if (!ticket) { res.status(404); throw new Error('Ticket not found'); }
    await syncTicketCount(ticket.contact);
    res.json({ message: 'Ticket removed' });
  } catch (error) { next(error); }
});

module.exports = router;
