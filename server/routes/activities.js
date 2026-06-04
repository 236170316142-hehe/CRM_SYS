const express = require('express');
const Activity = require('../models/Activity');
const Task = require('../models/Task');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

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

    // Auto-create a follow-up Task due in 24 hours if call is completed
    if (type === 'call' && outcome === 'completed') {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      await Task.create({
        subject: 'Follow-up Call',
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
