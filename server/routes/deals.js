const express = require('express');
const Deal = require('../models/Deal');
const { protect, admin } = require('../middleware/authMiddleware');
const { notifyDealStageChange } = require('../services/dealAlertService');
const { processStaleDeals } = require('../jobs/scheduler');
const { buildProposalPDF } = require('../services/proposalService');

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
    if (req.user.role === 'rep') query.assignedTo = req.user._id;

    const deals = await Deal.find(query)
      .populate('contact', 'name company')
      .populate('assignedTo', 'name email');
    res.json(deals);
  } catch (error) {
    next(error);
  }
});

// ── IMPORTANT: Static named routes MUST come before /:id ─────────────────────

// @desc    Get all stale deals summary (for pipeline sidebar)
// @route   GET /api/deals/stale
// @access  Private
router.get('/stale', async (req, res, next) => {
  try {
    const query = {
      isStale: true,
      stage: { $nin: ['closed-won', 'closed-lost'] },
    };
    if (req.user.role === 'rep') query.assignedTo = req.user._id;

    const staleDeals = await Deal.find(query)
      .populate('contact', 'name email company')
      .populate('assignedTo', 'name email')
      .sort({ lastActivityAt: 1 });

    res.json(staleDeals);
  } catch (error) {
    next(error);
  }
});

// @desc    Create a deal
// @route   POST /api/deals
// @access  Private
router.post('/', async (req, res, next) => {
  try {
    const { title, value, stage, leadId } = req.body;

    // If a leadId is provided, ensure a Contact record exists for it
    let contactId = req.body.contact;

    if (leadId) {
      const Lead    = require('../models/Lead');
      const Contact = require('../models/Contact');

      const lead = await Lead.findById(leadId).populate('assignedTo', 'name email');
      if (!lead) { res.status(404); throw new Error('Lead not found'); }

      // Upsert contact by email
      let contact = await Contact.findOne({ email: lead.email });
      if (!contact) {
        contact = await Contact.create({
          name:       lead.name,
          email:      lead.email,
          phone:      lead.phone   || '',
          company:    lead.company || '',
          assignedTo: lead.assignedTo?._id ?? null,
        });
        console.log(`[Deals] Auto-created Contact for lead "${lead.name}"`);
      }
      contactId = contact._id;
    }

    if (!contactId) { res.status(400); throw new Error('A contact is required to create a deal'); }

    const deal = await Deal.create({ title, value, stage: stage || 'prospect', contact: contactId });
    const populated = await Deal.findById(deal._id)
      .populate('contact', 'name company')
      .populate('assignedTo', 'name email');
    res.status(201).json(populated);
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
    if (!deal) { res.status(404); throw new Error('Deal not found'); }

    const oldStage = deal.stage;
    const newStage = req.body.stage;

    Object.assign(deal, req.body);
    deal.lastActivityAt = Date.now();
    deal.isStale = false;

    if (newStage && oldStage !== newStage) {
      deal.stageHistory.push({ stage: newStage, changedAt: Date.now() });
    }

    // Save FIRST — then fire side effects so deal is persisted before activities/emails
    await deal.save();

    if (newStage && oldStage !== newStage) {
      // Re-fetch with full populate so activity log has real data
      const savedDeal = await Deal.findById(deal._id)
        .populate('assignedTo', 'name email')
        .populate('contact', 'name email company');
      await notifyDealStageChange(savedDeal, oldStage, newStage, req.user);
    }

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
    if (!deal) { res.status(404); throw new Error('Deal not found'); }
    res.json({ message: 'Deal removed' });
  } catch (error) {
    next(error);
  }
});

// @desc    Manually trigger re-engagement for a stale deal
// @route   POST /api/deals/:id/re-engage
// @access  Private
router.post('/:id/re-engage', async (req, res, next) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('contact', 'name email company');
    if (!deal) { res.status(404); throw new Error('Deal not found'); }

    const isAdmin    = req.user.role === 'admin';
    const isAssigned = deal.assignedTo?._id?.toString() === req.user._id.toString();
    if (!isAdmin && !isAssigned) { res.status(403); throw new Error('Not authorised'); }

    const results = await processStaleDeals([deal]);
    res.json({ success: true, message: `Re-engagement triggered for "${deal.title}".`, results });
  } catch (error) {
    next(error);
  }
});

// @desc    Download/view proposal PDF
// @route   GET /api/deals/:id/proposal
// @access  Private
router.get('/:id/proposal', async (req, res, next) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate('contact')
      .populate('assignedTo', 'name email');
    if (!deal) { res.status(404); throw new Error('Deal not found'); }

    if (deal.proposalUrl) return res.redirect(deal.proposalUrl);

    const pdfBuffer = await buildProposalPDF(deal, deal.contact, deal.assignedTo);
    const fileName  = `Proposal_${deal.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// @desc    Resend proposal
// @route   POST /api/deals/:id/proposal/resend
// @access  Private
router.post('/:id/proposal/resend', async (req, res, next) => {
  try {
    const deal = await Deal.findById(req.params.id)
      .populate('contact')
      .populate('assignedTo', 'name email');
    if (!deal) { res.status(404); throw new Error('Deal not found'); }
    if (!deal.contact?.email) { res.status(400); throw new Error('No contact email'); }

    const { generateAndSendProposal } = require('../services/proposalService');
    const result = await generateAndSendProposal(deal, deal.contact, deal.assignedTo);

    await Deal.findByIdAndUpdate(deal._id, {
      proposalStatus: result.status,
      proposalSentAt: new Date(),
      pandaDocId:     result.pandaDocId,
      proposalUrl:    result.proposalUrl,
    });

    res.json({ success: true, message: `Proposal resent to ${deal.contact.email}`, proposalUrl: result.proposalUrl });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
