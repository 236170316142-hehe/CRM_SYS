const express = require('express');
const Deal = require('../models/Deal');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/authMiddleware');
const { startOfWeek, endOfWeek } = require('date-fns');

const router = express.Router();

router.use(protect);

// @desc    Get pipeline report
// @route   GET /api/reports/pipeline
// @access  Private
router.get('/pipeline', async (req, res, next) => {
  try {
    const match = {};
    if (req.user.role === 'rep') {
      match.assignedTo = req.user._id;
    }

    const pipelineData = await Deal.aggregate([
      {
        $match: match
      },
      {
        $group: {
          _id: '$stage',
          count: { $sum: 1 },
          totalValue: { $sum: '$value' }
        }
      }
    ]);

    res.json(pipelineData);
  } catch (error) {
    next(error);
  }
});

// @desc    Get activity report
// @route   GET /api/reports/activity
// @access  Private
router.get('/activity', async (req, res, next) => {
  try {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });

    const match = {
      createdAt: { $gte: start, $lte: end }
    };
    
    if (req.user.role === 'rep') {
      match.performedBy = req.user._id;
    }

    const activityData = await Activity.aggregate([
      {
        $match: match
      },
      {
        $group: {
          _id: '$performedBy',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 0,
          repId: '$_id',
          repName: '$user.name',
          count: 1
        }
      }
    ]);

    res.json(activityData);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
