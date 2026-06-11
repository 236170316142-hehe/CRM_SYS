const express = require('express');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Task = require('../models/Task');
const Contact = require('../models/Contact');
const { protect } = require('../middleware/authMiddleware');
const { autoAssignRep } = require('../services/assignmentService');
const { enrollNewLead, enrollDemoRequested } = require('../services/dripService');
const { sendSlackNotification, sendEmailNotification } = require('../services/notifyService');
const { sanitizePhone } = require('../utils/sanitize');

const router = express.Router();

router.use(protect);

// @desc    Get all leads
// @route   GET /api/leads
// @access  Private
router.get('/', async (req, res, next) => {
  try {
    const { status, assignedTo } = req.query;
    const query = {};
    if (status) query.status = status;
    
    if (req.user.role === 'rep') {
      query.assignedTo = req.user._id;
    } else if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    const leads = await Lead.find(query).populate('assignedTo', 'name email');
    res.json(leads);
  } catch (error) {
    next(error);
  }
});

// @desc    Create a lead
// @route   POST /api/leads
// @access  Private
router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, company, source, assignedTo } = req.body;

    // Validate phone if provided
    const phoneCheck = sanitizePhone(phone);
    if (!phoneCheck.valid) {
      res.status(422);
      throw new Error(phoneCheck.reason);
    }

    let assignedUser = null;

    if (assignedTo) {
      // Admin explicitly chose a rep
      assignedUser = await User.findById(assignedTo);
    } else {
      // Auto-assign using assignment rules
      assignedUser = await autoAssignRep(req.body.territory || null);
    }

    const lead = await Lead.create({
      name,
      email,
      phone,
      company,
      source,
      assignedTo: assignedUser ? assignedUser._id : null,
    });

    // Enroll in New Lead drip sequence (Day 0 / 2 / 5)
    await enrollNewLead(lead, assignedUser);

    // Notify assigned rep by email
    if (assignedUser) {
      await sendEmailNotification(
        assignedUser.email,
        'New Lead Assigned',
        `<p>You have been assigned a new lead: <strong>${lead.name}</strong> from <strong>${lead.company || 'Unknown'}</strong>.</p>
         <p>Email: ${lead.email}</p>`
      );
    }

    // Return lead with populated assignedTo
    const populated = await lead.populate('assignedTo', 'name email');
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

// @desc    Update a lead
// @route   PUT /api/leads/:id
// @access  Private
router.put('/:id', async (req, res, next) => {
  try {
    // Handle unassign: if assignedTo is empty string, set to null
    if (req.body.assignedTo === '') {
      req.body.assignedTo = null;
    }

    // Fetch current lead before update to detect stage transitions
    const currentLead = await Lead.findById(req.params.id);
    if (!currentLead) {
      res.status(404);
      throw new Error('Lead not found');
    }

    const previousStatus = currentLead.status;
    const newStatus = req.body.status;

    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('assignedTo', 'name email');

    if (!lead) {
      res.status(404);
      throw new Error('Lead not found');
    }

    // ── Stage-change triggers ──────────────────────────────────────────────
    if (newStatus && newStatus !== previousStatus) {

      // Trigger: Demo Requested drip when status becomes 'contacted'
      if (newStatus === 'contacted') {
        await enrollDemoRequested(lead, lead.assignedTo);
      }

      // Auto follow-up task for contacted / qualified
      if (['contacted', 'qualified'].includes(newStatus)) {
        const taskAssignee = lead.assignedTo?._id ?? lead.assignedTo ?? req.user._id;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        const subjectMap = {
          contacted: `Follow up with ${lead.name}${lead.company ? ` at ${lead.company}` : ''} — marked Contacted`,
          qualified: `Schedule a demo with ${lead.name}${lead.company ? ` at ${lead.company}` : ''} — marked Qualified`,
        };
        await Task.create({
          subject: subjectMap[newStatus],
          dueDate: tomorrow,
          status: 'pending',
          relatedTo: lead._id,
          onModel: 'Lead',
          assignedTo: taskAssignee,
        });
      }

      // ── Auto-convert lead → Contact when Won or Qualified ─────────────
      if (['won', 'qualified'].includes(newStatus)) {
        // Upsert: create contact if not already there (match by email)
        const existingContact = await Contact.findOne({ email: lead.email });
        if (!existingContact) {
          await Contact.create({
            name:       lead.name,
            email:      lead.email,
            phone:      lead.phone   || '',
            company:    lead.company || '',
            assignedTo: lead.assignedTo?._id ?? lead.assignedTo ?? null,
          });
          console.log(`[Leads] Auto-converted lead "${lead.name}" to Contact (status: ${newStatus})`);
        } else {
          // Update existing contact with latest info
          existingContact.phone   = lead.phone   || existingContact.phone;
          existingContact.company = lead.company || existingContact.company;
          existingContact.assignedTo = lead.assignedTo?._id ?? lead.assignedTo ?? existingContact.assignedTo;
          await existingContact.save();
          console.log(`[Leads] Updated existing Contact for "${lead.name}"`);
        }
      }
    }

    res.json(lead);
  } catch (error) {
    next(error);
  }
});

// @desc    Delete a lead
// @route   DELETE /api/leads/:id
// @access  Private
router.delete('/:id', async (req, res, next) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      res.status(404);
      throw new Error('Lead not found');
    }
    res.json({ message: 'Lead removed' });
  } catch (error) {
    next(error);
  }
});

// @desc    Score a lead event
// @route   POST /api/leads/:id/score-event
// @access  Private
router.post('/:id/score-event', async (req, res, next) => {
  try {
    const { event } = req.body;
    let points = 0;

    switch (event) {
      case 'email_opened': points = 5; break;
      case 'link_clicked': points = 10; break;
      case 'page_visit_pricing': points = 15; break;
      case 'page_visit_features': points = 8; break;
      case 'demo_requested': points = 30; break;
      case 'form_submitted': points = 20; break;
      case 'replied_to_email': points = 12; break;
      default: points = 0;
    }

    const lead = await Lead.findById(req.params.id).populate('assignedTo');
    if (!lead) {
      res.status(404);
      throw new Error('Lead not found');
    }

    const oldScore = lead.score;
    lead.score += points;
    await lead.save();

    // Check threshold
    if (oldScore < 50 && lead.score >= 50) {
      const msg = `Hot lead alert: ${lead.name} at ${lead.company || 'Unknown Company'} just hit score ${lead.score}`;
      await sendSlackNotification(msg);
      
      if (lead.assignedTo) {
        await sendEmailNotification(
          lead.assignedTo.email,
          'Hot Lead Alert!',
          `<p>${msg}</p>`
        );
      }
    }

    res.json(lead);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
