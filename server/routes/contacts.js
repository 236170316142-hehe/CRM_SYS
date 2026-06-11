const express = require('express');
const Contact = require('../models/Contact');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// @desc    Get all contacts
// @route   GET /api/contacts
// @access  Private
router.get('/', async (req, res, next) => {
  try {
    const query = {};
    if (req.user.role === 'rep') query.assignedTo = req.user._id;
    const contacts = await Contact.find(query).populate('assignedTo', 'name email');
    res.json(contacts);
  } catch (error) { next(error); }
});

// @desc    Get single contact with linked deals
// @route   GET /api/contacts/:id
// @access  Private
router.get('/:id', async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id).populate('assignedTo', 'name email');
    if (!contact) { res.status(404); throw new Error('Contact not found'); }

    const deals = await require('../models/Deal').find({ contact: req.params.id })
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    res.json({ ...contact.toObject(), deals });
  } catch (error) { next(error); }
});

// @desc    Create a contact
// @route   POST /api/contacts
// @access  Private
router.post('/', async (req, res, next) => {
  try {
    const contact = await Contact.create(req.body);
    res.status(201).json(contact);
  } catch (error) {
    next(error);
  }
});

// @desc    Update a contact
// @route   PUT /api/contacts/:id
// @access  Private
router.put('/:id', async (req, res, next) => {
  try {
    const contact = await Contact.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!contact) {
      res.status(404);
      throw new Error('Contact not found');
    }
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
