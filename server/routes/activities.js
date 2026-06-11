const express = require('express');
const Activity = require('../models/Activity');
const Task = require('../models/Task');
const User = require('../models/User');
const Deal = require('../models/Deal');
const Contact = require('../models/Contact');
const Lead = require('../models/Lead');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// @desc    Get all activities
// @route   GET /api/activities
// @access  Private
router.get('/', async (req, res, next) => {
  try {
    const query = {};
    if (req.query.type) query.type = req.query.type;

    const activities = await Activity.find(query)
      .populate('performedBy', 'name email')
      .populate({
        path: 'relatedTo',
        populate: {
          path: 'contact',
          select: 'name company'
        }
      })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(activities);
  } catch (error) {
    next(error);
  }
});

// @desc    Create an activity
// @route   POST /api/activities
// @access  Private
router.post('/', async (req, res, next) => {
  try {
    const { type, outcome, relatedTo, onModel } = req.body;
    const performedBy = req.user._id;

    const activity = await Activity.create({
      type,
      outcome,
      relatedTo,
      onModel,
      performedBy,
    });

    // Auto-create a follow-up Task due in 24 hours if:
    // - call is marked 'completed'
    // - meeting is logged (any outcome)
    const shouldCreateFollowUp =
      (type === 'call' && outcome === 'completed') ||
      (type === 'meeting');

    if (shouldCreateFollowUp) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      const subject =
        type === 'meeting'
          ? `Follow up after meeting`
          : `Follow up after call`;

      await Task.create({
        subject,
        dueDate,
        status: 'pending',
        relatedTo,
        onModel,
        assignedTo: performedBy,
      });
    }

    res.status(201).json(activity);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
