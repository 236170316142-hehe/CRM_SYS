const express = require('express');
const Lead = require('../models/Lead');
const PendingLead = require('../models/PendingLead');
const User = require('../models/User');
const Contact = require('../models/Contact');
const SupportTicket = require('../models/SupportTicket');
const { autoAssignRep } = require('../services/assignmentService');
const { enrollNewLead } = require('../services/dripService');
const { sendEmailNotification } = require('../services/notifyService');
const { validateEmail } = require('../services/emailValidationService');
const { sanitizePhone }  = require('../utils/sanitize');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function validateName(name) {
  const clean = (name || '').trim();
  if (clean.length < 2)
    return 'Please enter your full name.';
  if (/^[^a-zA-Z]*$/.test(clean))
    return 'Please enter a valid name.';
  if (/^(.)\1{3,}/i.test(clean))
    return 'Please enter your real name.';
  if (/^(qwerty|asdfg|zxcvb|abcde|test|fake|random|dummy|admin|anonymous|unknown|noname|n\/a|na$)/i.test(clean))
    return 'Please enter your real name.';
  return null;
}

function verificationEmailHtml(name, verifyUrl) {
  const firstName = name.split(' ')[0];
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#161b22;border-radius:12px 12px 0 0;padding:28px 40px;border-bottom:3px solid #3b82f6;">
            <span style="font-size:20px;font-weight:800;color:#3b82f6;">⚡ Teamgrid CRM</span>
          </td>
        </tr>
        <tr>
          <td style="background:#161b22;padding:40px;">
            <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#e6edf3;">
              Confirm your email, ${firstName} 👋
            </h2>
            <p style="margin:0 0 16px;font-size:15px;color:#8b949e;line-height:1.7;">
              You submitted a demo request on Teamgrid. To complete your registration and have
              a sales rep assigned to you, please verify this is your real email address.
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#8b949e;line-height:1.7;">
              This link expires in <strong style="color:#e6edf3;">1 hour</strong>.
            </p>
            <table cellpadding="0" cellspacing="0"><tr><td>
              <a href="${verifyUrl}"
                 style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;
                        font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;
                        box-shadow:0 4px 20px rgba(59,130,246,0.35);">
                ✅ Verify My Email
              </a>
            </td></tr></table>
            <p style="margin:32px 0 0;font-size:13px;color:#4a5568;line-height:1.6;">
              If you didn't submit this form, you can safely ignore this email.<br/>
              Or copy this link: <a href="${verifyUrl}" style="color:#3b82f6;word-break:break-all;">${verifyUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#0d1117;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:12px;color:#4a5568;">© 2026 Teamgrid CRM · This is an automated message</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Step 1 — Receive form, validate, send verification email
// @route   POST /api/webhooks/lead
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
router.post('/lead', async (req, res, next) => {
  try {
    const { name, email, phone, company, source, territory, message } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    // Validate all required fields
    if (!phone)     return res.status(422).json({ success: false, message: 'Phone number is required.' });
    if (!company)   return res.status(422).json({ success: false, message: 'Company name is required.' });
    if (!source)    return res.status(422).json({ success: false, message: 'Please select how you heard about us.' });
    if (!territory) return res.status(422).json({ success: false, message: 'Please select your region / territory.' });

    // Validate name
    const nameError = validateName(name);
    if (nameError) {
      return res.status(422).json({ success: false, message: nameError });
    }

    // Validate phone
    const phoneCheck = sanitizePhone(phone);
    if (!phoneCheck.valid) {
      return res.status(422).json({ success: false, message: phoneCheck.reason });
    }

    // Validate email — blocks disposable, fake, non-existent domains
    const emailCheck = await validateEmail(email);
    if (!emailCheck.valid) {
      return res.status(422).json({ success: false, message: emailCheck.reason });
    }

    // If already a confirmed lead, just acknowledge
    const existingLead = await Lead.findOne({ email: email.toLowerCase().trim() });
    if (existingLead) {
      return res.status(200).json({
        success: true,
        requiresVerification: false,
        message: 'Welcome back! Your details are already on file. Your rep will be in touch.',
      });
    }

    // Upsert pending lead (replaces if same email re-submits before verifying)
    const BASE_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
    const pending = await PendingLead.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone || '',
        company: company || '',
        territory: territory || '',
        source: source || 'web',
        message: message || '',
        token: require('crypto').randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        verified: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const verifyUrl = `${BASE_URL}/api/webhooks/verify-email/${pending.token}`;

    await sendEmailNotification(
      pending.email,
      'Please verify your email — Teamgrid CRM',
      verificationEmailHtml(pending.name, verifyUrl)
    );

    res.status(200).json({
      success: true,
      requiresVerification: true,
      message: `We've sent a verification link to ${pending.email}. Please check your inbox and click the link to complete your registration.`,
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Step 2 — Verify email token, create real lead, redirect to thank-you
// @route   GET /api/webhooks/verify-email/:token
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
router.get('/verify-email/:token', async (req, res, next) => {
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
  const DEMO_URL   = process.env.DEMO_SITE_URL || 'http://localhost:3000';

  try {
    const pending = await PendingLead.findOne({
      token: req.params.token,
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!pending) {
      // Expired or already used — redirect with error state
      return res.redirect(`${DEMO_URL}/?verified=expired`);
    }

    // Mark verified so the token can't be reused
    pending.verified = true;
    await pending.save();

    // Check again for duplicate (race condition guard)
    const existing = await Lead.findOne({ email: pending.email });
    if (existing) {
      return res.redirect(`${DEMO_URL}/?verified=already`);
    }

    // Create the real lead
    const assignedUser = await autoAssignRep(pending.territory || null);

    const lead = await Lead.create({
      name:       pending.name,
      email:      pending.email,
      phone:      pending.phone,
      company:    pending.company,
      territory:  pending.territory,
      source:     pending.source,
      assignedTo: assignedUser ? assignedUser._id : null,
      score:      20,
    });

    // Start drip sequence
    await enrollNewLead(lead, assignedUser);

    // Notify assigned rep
    if (assignedUser) {
      await sendEmailNotification(
        assignedUser.email,
        '✅ New Verified Lead Assigned',
        `<p>A new <strong>verified</strong> lead has been assigned to you:</p>
         <p><strong>Name:</strong> ${lead.name}<br/>
         <strong>Email:</strong> ${lead.email}<br/>
         <strong>Company:</strong> ${lead.company || '—'}<br/>
         <strong>Phone:</strong> ${lead.phone || '—'}<br/>
         ${pending.message ? `<strong>Message:</strong> ${pending.message}` : ''}</p>`
      );
    }

    // Clean up pending record
    await PendingLead.deleteOne({ _id: pending._id });

    // Redirect to thank-you page
    const repName = assignedUser ? encodeURIComponent(assignedUser.name) : '';
    res.redirect(`${DEMO_URL}/?verified=success&rep=${repName}`);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Receive Zendesk ticket events
// @route   POST /api/webhooks/zendesk
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
router.post('/zendesk', async (req, res, next) => {
  try {
    const { ticket_id, contact_email, subject, priority, status, description, ticket_url } = req.body;

    if (!ticket_id || !contact_email || !subject) {
      return res.status(400).json({ message: 'ticket_id, contact_email and subject are required' });
    }

    // Find contact by email (check both Contact and Lead collections)
    let contact = await Contact.findOne({ email: contact_email });
    if (!contact) {
      // Auto-create contact from Lead if exists
      const Lead = require('../models/Lead');
      const lead = await Lead.findOne({ email: contact_email });
      if (lead) {
        contact = await Contact.create({
          name:    lead.name,
          email:   lead.email,
          phone:   lead.phone   || '',
          company: lead.company || '',
          assignedTo: lead.assignedTo || null,
        });
      }
    }
    if (!contact) {
      return res.status(404).json({ message: `No contact found for email: ${contact_email}` });
    }

    const ticket = await SupportTicket.findOneAndUpdate(
      { externalId: String(ticket_id) },
      {
        contact:    contact._id,
        subject,
        description: description || '',
        priority:   priority || 'normal',
        status:     status   || 'open',
        source:     'zendesk',
        externalUrl: ticket_url || null,
        externalCreatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const openCount = await SupportTicket.countDocuments({
      contact: contact._id,
      status: { $in: ['open', 'pending'] },
    });
    contact.openTicketCount = openCount;
    await contact.save();

    // Alert sales rep for high/urgent tickets
    const { sendSlackNotification, sendEmailNotification } = require('../services/notifyService');
    if (['high', 'urgent'].includes(priority)) {
      const Deal = require('../models/Deal');
      const deal = await Deal.findOne({ contact: contact._id })
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 });

      if (deal?.assignedTo?.email) {
        const label = priority === 'urgent' ? '🚨 URGENT' : '⚠️ HIGH';
        await sendSlackNotification(
          `${label} Zendesk Ticket | Customer: *${contact.name}* | "${subject}" | ID: ${ticket_id}`
        );
        await sendEmailNotification(
          deal.assignedTo.email,
          `${label} Zendesk Ticket: ${contact.name} — "${subject}"`,
          `<p>Hi ${deal.assignedTo.name},</p><p>Your customer <strong>${contact.name}</strong> has a <strong>${priority}</strong> priority support ticket:</p><p><strong>${subject}</strong></p>${ticket_url ? `<p><a href="${ticket_url}">View in Zendesk →</a></p>` : ''}`
        );
      }
    }

    res.status(200).json({ success: true, ticketId: ticket._id, openTickets: openCount });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Receive Freshdesk ticket events
// @route   POST /api/webhooks/freshdesk
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
router.post('/freshdesk', async (req, res, next) => {
  try {
    // Freshdesk sends nested payload: { freshdesk_webhook: { ticket_id, requester_email, ... } }
    const payload = req.body.freshdesk_webhook || req.body;
    const {
      ticket_id, requester_email, subject,
      ticket_priority, ticket_status, ticket_url,
    } = payload;

    if (!ticket_id || !requester_email || !subject) {
      return res.status(400).json({ message: 'ticket_id, requester_email and subject are required' });
    }

    // Priority mapping: Freshdesk uses 1=Low 2=Medium 3=High 4=Urgent
    const priorityMap = { 1: 'low', 2: 'normal', 3: 'high', 4: 'urgent' };
    const statusMap   = { 2: 'open', 3: 'pending', 4: 'solved', 5: 'closed' };
    const priority = priorityMap[ticket_priority] || 'normal';
    const status   = statusMap[ticket_status]     || 'open';

    let contact = await Contact.findOne({ email: requester_email });
    if (!contact) {
      const Lead = require('../models/Lead');
      const lead = await Lead.findOne({ email: requester_email });
      if (lead) {
        contact = await Contact.create({
          name: lead.name, email: lead.email,
          phone: lead.phone || '', company: lead.company || '',
          assignedTo: lead.assignedTo || null,
        });
      }
    }
    if (!contact) {
      return res.status(404).json({ message: `No contact found for email: ${requester_email}` });
    }

    const ticket = await SupportTicket.findOneAndUpdate(
      { externalId: `fd_${ticket_id}` },
      {
        contact:    contact._id,
        subject,
        priority,
        status,
        source:     'freshdesk',
        externalUrl: ticket_url || null,
        externalCreatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const openCount = await SupportTicket.countDocuments({
      contact: contact._id,
      status: { $in: ['open', 'pending'] },
    });
    contact.openTicketCount = openCount;
    await contact.save();

    res.status(200).json({ success: true, ticketId: ticket._id, openTickets: openCount });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    QA test endpoint
// @route   POST /api/webhooks/test-drip
// @access  Public (non-production only)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/test-drip', async (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_TEST_DRIP) {
    return res.status(403).json({ message: 'Test endpoint disabled in production.' });
  }
  try {
    const { sequence = 'new_lead', email, firstName = 'Test', company = 'Test Corp' } = req.body;
    if (!email) return res.status(400).json({ message: 'email is required' });

    const { enrollNewLead, enrollDemoRequested } = require('../services/dripService');
    const mockLead = {
      _id: new (require('mongoose').Types.ObjectId)(),
      email, name: firstName, company,
    };

    if (sequence === 'demo_requested') {
      await enrollDemoRequested(mockLead, null);
    } else {
      await enrollNewLead(mockLead, null);
    }

    res.json({ success: true, message: `Enrolled in "${sequence}" sequence.`, lead: { email, firstName, company }, sequence });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
