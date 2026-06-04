const express = require('express');
const AssignmentRule = require('../models/AssignmentRule');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect, admin);

// Get current assignment rule
router.get('/', async (req, res, next) => {
  try {
    let rule = await AssignmentRule.findOne();
    if (!rule) {
      rule = await AssignmentRule.create({ type: 'round_robin' });
    }
    res.json(rule);
  } catch (error) {
    next(error);
  }
});

// Update assignment rule (admin only)
router.put('/', async (req, res, next) => {
  try {
    const { type } = req.body;
    if (!['round_robin', 'territory'].includes(type)) {
      res.status(400);
      throw new Error('Invalid rule type');
    }
    let rule = await AssignmentRule.findOne();
    if (!rule) {
      rule = await AssignmentRule.create({ type });
    } else {
      rule.type = type;
      await rule.save();
    }
    res.json(rule);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
