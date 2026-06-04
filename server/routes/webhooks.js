const express = require('express');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Contact = require('../models/Contact');
const SupportTicket = require('../models/SupportTicket');
const { welcomeEmailQueue } = require('../jobs/queues');
const { sendEmailNotification } = require('../services/notifyService');

const router = express.Router();

// @desc    Receive external lead form submissions
// @route   POST /api/webhooks/lead
// @access  Public
router.post('/lead', async (req, res, next) => {
  try {
    const { name, email, phone, company, source } = req.body;

    // Check duplicate by email
    const existingLead = await Lead.findOne({ email });
    if (existingLead) {
      existingLead.score += 10; // Boost score for re-engagement
      if (phone) existingLead.phone = phone;
      if (company) existingLead.company = company;
      if (source) existingLead.source = source;
      await existingLead.save();

      return res.status(200).json({ 
        success: true, 
        leadId: existingLead._id, 
        message: 'Duplicate lead found; updated existing lead record.' 
      });
    }

    const users = await User.find({ role: 'rep' });
    const assignedUser = users.length > 0 ? users[Math.floor(Math.random() * users.length)] : null;

    const lead = await Lead.create({
      name,
      email,
      phone,
      company,
      source: source || 'web',
      assignedTo: assignedUser ? assignedUser._id : null,
      score: 20, // Initial score for form submission
    });

    const jobData = {
      email: lead.email,
      firstName: lead.name.split(' ')[0],
      company: lead.company || 'your company',
    };

    await welcomeEmailQueue.add('welcomeEmailDay0', { ...jobData, sequenceDay: 0 });
    await welcomeEmailQueue.add('welcomeEmailDay2', { ...jobData, sequenceDay: 2 }, { delay: 2 * 24 * 60 * 60 * 1000 });
    await welcomeEmailQueue.add('welcomeEmailDay5', { ...jobData, sequenceDay: 5 }, { delay: 5 * 24 * 60 * 60 * 1000 });

    if (assignedUser) {
      await sendEmailNotification(
        assignedUser.email,
        'New Lead Assigned via Webhook',
        `<p>You have been assigned a new lead: ${lead.name} from ${lead.company || 'Unknown'}.</p>`
      );
    }

    res.status(200).json({ success: true, leadId: lead._id });
  } catch (error) {
    next(error);
  }
});

// @desc    Receive Zendesk ticket events
// @route   POST /api/webhooks/zendesk
// @access  Public
router.post('/zendesk', async (req, res, next) => {
  try {
    const { ticket_id, contact_email, subject, priority, status } = req.body;

    const contact = await Contact.findOne({ email: contact_email });
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    const ticket = await SupportTicket.findOneAndUpdate(
      { externalId: ticket_id },
      { contact: contact._id, subject, priority, status },
      { upsert: true, new: true }
    );

    // Update open ticket count
    const openTickets = await SupportTicket.countDocuments({
      contact: contact._id,
      status: { $in: ['open', 'pending'] }
    });
    
    contact.openTicketCount = openTickets;
    await contact.save();

    res.status(200).json({ success: true, ticketId: ticket._id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
