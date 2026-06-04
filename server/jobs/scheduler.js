const cron = require('node-cron');
const Deal = require('../models/Deal');
const Contract = require('../models/Contract');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { sendSlackNotification, sendEmailNotification } = require('../services/notifyService');
const { startOfWeek, endOfWeek } = require('date-fns');

// staleDealsJob - daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  console.log('Running staleDealsJob...');
  try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const staleDeals = await Deal.find({
      lastActivityAt: { $lt: fourteenDaysAgo },
      isStale: false,
      stage: { $nin: ['closed-won', 'closed-lost'] }
    }).populate('assignedTo', 'name email').populate('contact', 'email');

    for (const deal of staleDeals) {
      deal.isStale = true;
      await deal.save();

      const ownerName = deal.assignedTo ? deal.assignedTo.name : 'Unknown';
      await sendSlackNotification(`Stale Deal Alert: "${deal.title}" owned by ${ownerName} has been inactive for 14 days.`);

      if (deal.contact && deal.contact.email) {
        await sendEmailNotification(
          deal.contact.email,
          'Checking in',
          `<p>Hi, just wanted to check in regarding "${deal.title}". Are you still interested?</p>`
        );
      }
    }
  } catch (error) {
    console.error('Error in staleDealsJob:', error);
  }
});

// renewalReminderJob - daily at 8 AM
cron.schedule('0 8 * * *', async () => {
  console.log('Running renewalReminderJob...');
  try {
    const today = new Date();
    const checkDays = [90, 60, 30];

    for (const days of checkDays) {
      const targetDateStart = new Date(today);
      targetDateStart.setDate(targetDateStart.getDate() + days);
      targetDateStart.setHours(0, 0, 0, 0);

      const targetDateEnd = new Date(targetDateStart);
      targetDateEnd.setHours(23, 59, 59, 999);

      const contracts = await Contract.find({
        endDate: { $gte: targetDateStart, $lte: targetDateEnd },
        status: 'active'
      }).populate({
        path: 'deal',
        populate: { path: 'assignedTo contact' }
      });

      for (const contract of contracts) {
        if (contract.deal && contract.deal.assignedTo && contract.deal.contact) {
          const repEmail = contract.deal.assignedTo.email;
          const contactEmail = contract.deal.contact.email;

          // Notify Rep
          await sendEmailNotification(
            repEmail,
            `Contract Renewal in ${days} days`,
            `<p>The contract for "${contract.deal.title}" is expiring in ${days} days.</p>`
          );

          // Notify Contact
          await sendEmailNotification(
            contactEmail,
            `Your contract is up for renewal soon`,
            `<p>Hi, your contract is expiring in ${days} days. Let's discuss renewal.</p>`
          );
        }
      }
    }
  } catch (error) {
    console.error('Error in renewalReminderJob:', error);
  }
});

// weeklyReportJob - Mondays at 8 AM
cron.schedule('0 8 * * 1', async () => {
  console.log('Running weeklyReportJob...');
  try {
    const reportEmail = process.env.REPORT_EMAIL_RECIPIENT;
    if (!reportEmail) return;

    const pipelineData = await Deal.aggregate([
      { $match: { stage: { $nin: ['closed-won', 'closed-lost'] } } },
      { $group: { _id: '$stage', count: { $sum: 1 }, totalValue: { $sum: '$value' } } }
    ]);

    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });

    const activityData = await Activity.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$performedBy', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 0, repName: '$user.name', count: 1 } }
    ]);

    let html = '<h1>Weekly CRM Report</h1><h2>Pipeline Summary</h2><ul>';
    pipelineData.forEach(stage => {
      html += `<li>${stage._id}: ${stage.count} deals, $${stage.totalValue}</li>`;
    });
    html += '</ul><h2>Rep Activity</h2><ul>';
    activityData.forEach(rep => {
      html += `<li>${rep.repName}: ${rep.count} activities</li>`;
    });
    html += '</ul>';

    await sendEmailNotification(reportEmail, 'Weekly CRM Report', html);

  } catch (error) {
    console.error('Error in weeklyReportJob:', error);
  }
});
