const express = require('express');
const Contract = require('../models/Contract');
const Deal     = require('../models/Deal');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/authMiddleware');
const { processRenewalReminders } = require('../services/renewalService');

const router = express.Router();
router.use(protect);

// @desc    Get all contracts (scoped by role)
// @route   GET /api/contracts
// @access  Private
router.get('/', async (req, res, next) => {
  try {
    const query = {};
    if (req.user.role === 'rep') {
      // reps only see contracts for deals assigned to them
      const myDeals = await Deal.find({ assignedTo: req.user._id }, '_id');
      query.deal = { $in: myDeals.map(d => d._id) };
    }

    const contracts = await Contract.find(query)
      .populate('contact', 'name email company')
      .populate({
        path: 'deal',
        select: 'title value stage assignedTo',
        populate: { path: 'assignedTo', select: 'name email' },
      })
      .sort({ endDate: 1 });

    res.json(contracts);
  } catch (error) { next(error); }
});

// @desc    Get contracts for a specific deal
// @route   GET /api/contracts/deal/:dealId
// @access  Private
router.get('/deal/:dealId', async (req, res, next) => {
  try {
    const contracts = await Contract.find({ deal: req.params.dealId })
      .populate('contact', 'name email company')
      .sort({ endDate: 1 });
    res.json(contracts);
  } catch (error) { next(error); }
});

// @desc    Create a contract
// @route   POST /api/contracts
// @access  Private
router.post('/', async (req, res, next) => {
  try {
    const { title, deal, contact, startDate, endDate, value, notes } = req.body;

    if (!deal || !endDate) {
      res.status(400);
      throw new Error('Deal and end date are required');
    }

    // Resolve contact from deal if not provided
    let contactId = contact;
    if (!contactId) {
      const dealDoc = await Deal.findById(deal).populate('contact');
      contactId = dealDoc?.contact?._id;
    }
    if (!contactId) {
      res.status(400);
      throw new Error('Could not resolve a contact for this contract');
    }

    const dealDoc = await Deal.findById(deal);
    const contractTitle = title || (dealDoc ? `${dealDoc.title} — Contract` : 'Contract');

    const contract = await Contract.create({
      title: contractTitle,
      deal,
      contact: contactId,
      startDate: startDate || new Date(),
      endDate,
      value:  value  || dealDoc?.value  || 0,
      notes:  notes  || '',
      remindersSent: [],
    });

    const populated = await Contract.findById(contract._id)
      .populate('contact', 'name email company')
      .populate({ path: 'deal', select: 'title value stage', populate: { path: 'assignedTo', select: 'name email' } });

    res.status(201).json(populated);
  } catch (error) { next(error); }
});

// @desc    Update a contract
// @route   PUT /api/contracts/:id
// @access  Private
router.put('/:id', async (req, res, next) => {
  try {
    const contract = await Contract.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('contact', 'name email company')
      .populate({ path: 'deal', select: 'title value stage', populate: { path: 'assignedTo', select: 'name email' } });

    if (!contract) { res.status(404); throw new Error('Contract not found'); }
    res.json(contract);
  } catch (error) { next(error); }
});

// @desc    Delete a contract
// @route   DELETE /api/contracts/:id
// @access  Private
router.delete('/:id', async (req, res, next) => {
  try {
    const contract = await Contract.findByIdAndDelete(req.params.id);
    if (!contract) { res.status(404); throw new Error('Contract not found'); }
    res.json({ message: 'Contract removed' });
  } catch (error) { next(error); }
});

// @desc    Manually trigger renewal reminders (for testing)
// @route   POST /api/contracts/trigger-reminders
// @access  Private (admin)
router.post('/trigger-reminders', async (req, res, next) => {
  if (req.user.role !== 'admin') {
    res.status(403); throw new Error('Admin only');
  }
  try {
    const results = await processRenewalReminders();
    res.json({ success: true, results });
  } catch (error) { next(error); }
});

// @desc    Get activity log for a contract
// @route   GET /api/contracts/:id/activities
// @access  Private
router.get('/:id/activities', async (req, res, next) => {
  try {
    const activities = await Activity.find({
      relatedTo: req.params.id,
      onModel: 'Contract',
    }).populate('performedBy', 'name').sort({ createdAt: -1 });
    res.json(activities);
  } catch (error) { next(error); }
});

module.exports = router;
