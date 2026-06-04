const express = require('express');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { welcomeEmailQueue } = require('../jobs/queues');
const { sendSlackNotification, sendEmailNotification } = require('../services/notifyService');

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

    let assignedUser = null;

    if (assignedTo) {
      // Admin explicitly chose a rep
      assignedUser = await User.findById(assignedTo);
    } else {
      // Auto-assign using assignment rules
      const AssignmentRule = require('../models/AssignmentRule');

      let rule = await AssignmentRule.findOne();
      if (!rule) {
        // create default rule (round_robin) if missing
        rule = await AssignmentRule.create({ type: 'round_robin' });
      }

      // Helper to pick next rep in list using lastAssigned pointer
      const pickNext = async (reps, pointerKey) => {
        if (!reps || reps.length === 0) return null;
        // reps are ordered by _id for deterministic rotation
        reps.sort((a, b) => a._id.toString().localeCompare(b._id.toString()));

        const lastId = rule.lastAssigned && rule.lastAssigned[pointerKey] ? rule.lastAssigned[pointerKey] : rule.lastAssigned || null;
        let idx = 0;
        if (lastId) {
          const found = reps.findIndex(r => r._id.toString() === lastId.toString());
          idx = found >= 0 ? (found + 1) % reps.length : 0;
        }
        const chosen = reps[idx];
        // persist pointer
        if (!rule.lastAssigned || typeof rule.lastAssigned === 'string') {
          // convert to map form for consistent storage
          rule.lastAssigned = {};
        }
        rule.lastAssigned[pointerKey] = chosen._id;
        await rule.save();
        return chosen;
      };

      if (rule.type === 'round_robin') {
        const reps = await User.find({ role: 'rep', approved: true });
        assignedUser = await pickNext(reps, 'global');
      } else if (rule.type === 'territory') {
        // try to match by lead territory, fall back to all reps
        let reps = [];
        if (req.body.territory) {
          reps = await User.find({ role: 'rep', approved: true, territory: req.body.territory });
        }
        if (!reps || reps.length === 0) {
          reps = await User.find({ role: 'rep', approved: true });
        }
        const pointerKey = req.body.territory || 'global';
        assignedUser = await pickNext(reps, pointerKey);
      } else {
        // unknown rule: fallback to random
        const reps = await User.find({ role: 'rep', approved: true });
        if (reps.length > 0) assignedUser = reps[Math.floor(Math.random() * reps.length)];
      }
    }

    const lead = await Lead.create({
      name,
      email,
      phone,
      company,
      source,
      assignedTo: assignedUser ? assignedUser._id : null,
    });

    // Enqueue welcome emails
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
        'New Lead Assigned',
        `<p>You have been assigned a new lead: ${lead.name} from ${lead.company || 'Unknown'}.</p>`
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
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('assignedTo', 'name email');
    if (!lead) {
      res.status(404);
      throw new Error('Lead not found');
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
