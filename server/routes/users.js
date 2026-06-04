const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const { protect, admin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// @desc    Get approved reps only (accessible to all authenticated users, e.g. for lead assignment dropdowns)
// @route   GET /api/users/reps
// @access  Private
router.get('/reps', async (req, res, next) => {
  try {
    const reps = await User.find({ role: 'rep', approved: true }).select('name email role');
    res.json(reps);
  } catch (error) {
    next(error);
  }
});

router.use(admin);

// @desc    Get all users (reps and admins)
// @route   GET /api/users
// @access  Private/Admin
router.get('/', async (req, res, next) => {
  try {
    const users = await User.find({}).select('-passwordHash');
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// @desc    Create / Add a new sales rep directly (approved by default)
// @route   POST /api/users
// @access  Private/Admin
router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role: role || 'rep',
      approved: true, // Directly created by admin, so pre-approved
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      approved: user.approved,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Approve/toggle user approval status
// @route   PUT /api/users/:id/approve
// @access  Private/Admin
router.put('/:id/approve', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    user.approved = true;
    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      approved: user.approved,
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/Admin
router.delete('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    if (user._id.toString() === req.user._id.toString()) {
      res.status(400);
      throw new Error('You cannot delete your own admin account');
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User removed' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
