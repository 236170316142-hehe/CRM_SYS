const express = require('express');
const Deal = require('../models/Deal');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const Task = require('../models/Task');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { startOfWeek, endOfWeek, subWeeks } = require('date-fns');

const router = express.Router();
router.use(protect);

// @desc  Pipeline value + count by stage
// @route GET /api/reports/pipeline
router.get('/pipeline', async (req, res, next) => {
  try {
    const match = {};
    if (req.user.role === 'rep') match.assignedTo = req.user._id;

    const data = await Deal.aggregate([
      { $match: match },
      { $group: { _id: '$stage', count: { $sum: 1 }, totalValue: { $sum: '$value' } } },
      { $sort: { totalValue: -1 } },
    ]);

    // Human-readable stage labels
    const LABELS = {
      prospect: 'Prospect', proposal: 'Proposal',
      negotiation: 'Negotiation', 'closed-won': 'Closed Won', 'closed-lost': 'Closed Lost',
    };
    const formatted = data.map(d => ({ ...d, label: LABELS[d._id] || d._id }));
    res.json(formatted);
  } catch (error) { next(error); }
});

// @desc  Weekly rep activity count
// @route GET /api/reports/activity
router.get('/activity', async (req, res, next) => {
  try {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end   = endOfWeek(new Date(), { weekStartsOn: 1 });
    const match = { createdAt: { $gte: start, $lte: end } };
    if (req.user.role === 'rep') match.performedBy = req.user._id;

    const data = await Activity.aggregate([
      { $match: match },
      { $group: { _id: '$performedBy', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 0, repName: '$user.name', count: 1 } },
      { $sort: { count: -1 } },
    ]);
    res.json(data);
  } catch (error) { next(error); }
});

// @desc  Lead status breakdown
// @route GET /api/reports/leads
router.get('/leads', async (req, res, next) => {
  try {
    const match = {};
    if (req.user.role === 'rep') match.assignedTo = req.user._id;

    const [byStatus, bySource, recentTrend] = await Promise.all([
      // Count by status
      Lead.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Count by source
      Lead.aggregate([
        { $match: match },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Last 8 weeks trend
      Lead.aggregate([
        {
          $match: {
            ...match,
            createdAt: { $gte: subWeeks(new Date(), 8) },
          },
        },
        {
          $group: {
            _id: {
              year:  { $year: '$createdAt' },
              week:  { $isoWeek: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.week': 1 } },
        {
          $project: {
            _id: 0,
            week: { $concat: ['W', { $toString: '$_id.week' }] },
            count: 1,
          },
        },
      ]),
    ]);

    const STATUS_LABELS = {
      new: 'New', contacted: 'Contacted', qualified: 'Qualified', won: 'Won', lost: 'Lost',
    };
    const SOURCE_LABELS = {
      web: 'Web', linkedin: 'LinkedIn', chat: 'Chat', email: 'Email',
    };

    res.json({
      byStatus: byStatus.map(d => ({ ...d, label: STATUS_LABELS[d._id] || d._id })),
      bySource: bySource.map(d => ({ ...d, label: SOURCE_LABELS[d._id] || d._id })),
      weeklyTrend: recentTrend,
    });
  } catch (error) { next(error); }
});

// @desc  Summary KPIs — total deals, total leads, conversion rate, open tasks
// @route GET /api/reports/summary
router.get('/summary', async (req, res, next) => {
  try {
    const repFilter = req.user.role === 'rep' ? { assignedTo: req.user._id } : {};

    const [
      totalLeads, wonLeads, totalDeals, wonDeals,
      openTasks, overdueTasks, totalDealValue,
    ] = await Promise.all([
      Lead.countDocuments(repFilter),
      Lead.countDocuments({ ...repFilter, status: 'won' }),
      Deal.countDocuments(repFilter),
      Deal.countDocuments({ ...repFilter, stage: 'closed-won' }),
      Task.countDocuments({ ...repFilter, status: 'pending' }),
      Task.countDocuments({ ...repFilter, status: 'pending', dueDate: { $lt: new Date() } }),
      Deal.aggregate([
        { $match: { ...repFilter, stage: { $nin: ['closed-lost'] } } },
        { $group: { _id: null, total: { $sum: '$value' } } },
      ]),
    ]);

    const leadConversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
    const dealWinRate        = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

    res.json({
      totalLeads,
      wonLeads,
      leadConversionRate,
      totalDeals,
      wonDeals,
      dealWinRate,
      openTasks,
      overdueTasks,
      totalPipelineValue: totalDealValue[0]?.total || 0,
    });
  } catch (error) { next(error); }
});

module.exports = router;
