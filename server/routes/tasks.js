const express = require('express');
const Task = require('../models/Task');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private
router.get('/', async (req, res, next) => {
  try {
    const { assignedTo } = req.query;
    const query = {};
    if (assignedTo) query.assignedTo = assignedTo;

    const tasks = await Task.find(query).populate('relatedTo');
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

// @desc    Create a task
// @route   POST /api/tasks
// @access  Private
router.post('/', async (req, res, next) => {
  try {
    const task = await Task.create(req.body);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

// @desc    Update a task
// @route   PUT /api/tasks/:id
// @access  Private
router.put('/:id', async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
