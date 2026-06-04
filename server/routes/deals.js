const express = require('express');
const Deal = require('../models/Deal');
const { protect } = require('../middleware/authMiddleware');
const { sendSlackNotification } = require('../services/notifyService');

const router = express.Router();

router.use(protect);

// @desc    Get all deals
// @route   GET /api/deals
// @access  Private
router.get('/', async (req, res, next) => {
  try {
    const { stage } = req.query;
    const query = {};
    if (stage) query.stage = stage;

    if (req.user.role === 'rep') {
      query.assignedTo = req.user._id;
    }

    const deals = await Deal.find(query)
      .populate('contact', 'name company')
      .populate('assignedTo', 'name email');
    res.json(deals);
  } catch (error) {
    next(error);
  }
});

// @desc    Create a deal
// @route   POST /api/deals
// @access  Private
router.post('/', async (req, res, next) => {
  try {
    const deal = await Deal.create(req.body);
    res.status(201).json(deal);
  } catch (error) {
    next(error);
  }
});

// @desc    Update a deal
// @route   PUT /api/deals/:id
// @access  Private
router.put('/:id', async (req, res, next) => {
  try {
    const deal = await Deal.findById(req.params.id).populate('assignedTo');
    if (!deal) {
      res.status(404);
      throw new Error('Deal not found');
    }

    const oldStage = deal.stage;
    const newStage = req.body.stage;

    // Update fields
    Object.assign(deal, req.body);
    
    // Reset lastActivityAt on any update
    deal.lastActivityAt = Date.now();
    deal.isStale = false;

    // Handle stage change
    if (newStage && oldStage !== newStage) {
      deal.stageHistory.push({ stage: newStage, changedAt: Date.now() });
      
      // Fire slack notification
      const ownerName = deal.assignedTo ? deal.assignedTo.name : 'Unknown';
      await sendSlackNotification(`Deal Stage Update: Deal "${deal.title}" owned by ${ownerName} moved to ${newStage}.`);
    }

    await deal.save();
    res.json(deal);
  } catch (error) {
    next(error);
  }
});

// @desc    Delete a deal
// @route   DELETE /api/deals/:id
// @access  Private
router.delete('/:id', async (req, res, next) => {
  try {
    const deal = await Deal.findByIdAndDelete(req.params.id);
    if (!deal) {
      res.status(404);
      throw new Error('Deal not found');
    }
    res.json({ message: 'Deal removed' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
