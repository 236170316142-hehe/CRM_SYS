const express = require('express');
const Task = require('../models/Task');
const User = require('../models/User');
const Deal = require('../models/Deal');
const Lead = require('../models/Lead');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// @desc    Get tasks for the logged-in user (reps see only theirs, admins see all)
// @route   GET /api/tasks
// @access  Private
router.get('/', async (req, res, next) => {
  try {
    const query = {};

    // Reps only see their own tasks
    if (req.user.role === 'rep') {
      query.assignedTo = req.user._id;
    } else if (req.query.assignedTo) {
      query.assignedTo = req.query.assignedTo;
    }

    if (req.query.status) query.status = req.query.status;

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email')
      .populate('relatedTo')
      .sort({ dueDate: 1 });

    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

// @desc    Create a task manually
// @route   POST /api/tasks
// @access  Private
router.post('/', async (req, res, next) => {
  try {
    const task = await Task.create({
      ...req.body,
      assignedTo: req.body.assignedTo || req.user._id,
    });
    const populated = await task.populate('assignedTo', 'name email');
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
});

// @desc    Update a task (e.g. mark done)
// @route   PUT /api/tasks/:id
// @access  Private
router.put('/:id', async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('assignedTo', 'name email')
      .populate('relatedTo');
    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
});

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private
router.delete('/:id', async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }
    res.json({ message: 'Task removed' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
