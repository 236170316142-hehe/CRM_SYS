const cron = require('node-cron');
const Deal = require('../models/Deal');
const Contract = require('../models/Contract');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { sendSlackNotification, sendEmailNotification } = require('../services/notifyService');
const { startOfWeek, endOfWeek } = require('date-fns');

// ─────────────────────────────────────────────────────────────────────────────
// Email templates for stale deal re-engagement
// ─────────────────────────────────────────────────────────────────────────────

function staleOwnerAlertHtml({ ownerName, dealTitle, contactName, daysSince, dashboardUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
        <tr>
          <td style="background:#161b22;border-radius:12px 12px 0 0;padding:24px 36px;border-bottom:3px solid #f59e0b;">
            <span style="font-size:18px;font-weight:800;color:#f59e0b;">⚡ Teamgrid CRM</span>
            <span style="font-size:13px;color:#8b949e;margin-left:12px;">Stale Deal Alert</span>
          </td>
        </tr>
        <tr>
          <td style="background:#161b22;padding:32px 36px;">
            <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#e6edf3;">
              Action Required: Deal Going Cold 🥶
            </h2>
            <p style="margin:0 0 24px;font-size:14px;color:#8b949e;line-height:1.7;">
              Hi ${ownerName}, a deal you own hasn't had any activity for <strong style="color:#f59e0b;">${daysSince} days</strong>.
              It's been tagged as <strong style="color:#ef4444;">Stale</strong> in the pipeline.
            </p>

            <table width="100%" cellpadding="16" cellspacing="0"
                   style="background:#1c2330;border:1px solid rgba(245,158,11,0.2);border-radius:10px;margin-bottom:24px;">
              <tr>
                <td>
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:4px;">Deal</div>
                  <div style="font-size:16px;font-weight:700;color:#e6edf3;">${dealTitle}</div>
                </td>
              </tr>
              <tr>
                <td style="border-top:1px solid rgba(255,255,255,0.05);">
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:4px;">Contact</div>
                  <div style="font-size:15px;color:#c9d1d9;">${contactName}</div>
                </td>
              </tr>
              <tr>
                <td style="border-top:1px solid rgba(255,255,255,0.05);">
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:4px;">Last Activity</div>
                  <div style="font-size:15px;color:#ef4444;font-weight:600;">${daysSince} days ago</div>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;font-size:14px;color:#8b949e;line-height:1.7;">
              A re-engagement email has automatically been sent to the contact.
              We recommend following up with a personal touch today.
            </p>

            <a href="${dashboardUrl}"
               style="display:inline-block;background:#f59e0b;color:#000000;text-decoration:none;
                      font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;">
              View Deal in Pipeline →
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#0d1117;border-radius:0 0 12px 12px;padding:16px 36px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="margin:0;font-size:11px;color:#4a5568;">© 2026 Teamgrid CRM · Automated Alert</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function staleContactReEngageHtml({ contactFirstName, dealTitle, ownerName, ownerEmail }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
        <tr>
          <td style="background:#161b22;border-radius:12px 12px 0 0;padding:24px 36px;border-bottom:3px solid #3b82f6;">
            <span style="font-size:18px;font-weight:800;color:#3b82f6;">⚡ Teamgrid CRM</span>
          </td>
        </tr>
        <tr>
          <td style="background:#161b22;padding:36px;">
            <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;">
              Hey ${contactFirstName}, just checking in 👋
            </h2>
            <p style="margin:0 0 16px;font-size:15px;color:#8b949e;line-height:1.8;">
              It's been a little while since we last connected about
              <strong style="color:#e6edf3;">${dealTitle}</strong>, and I wanted to make sure
              everything is still on track on your end.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#8b949e;line-height:1.8;">
              Things move fast — if your priorities have shifted or if you have any
              new questions, I'd love to reconnect and make sure we're still aligned.
            </p>

            <table width="100%" cellpadding="20" cellspacing="0"
                   style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);
                          border-radius:10px;margin-bottom:28px;">
              <tr>
                <td>
                  <p style="margin:0 0 12px;font-size:14px;color:#c9d1d9;font-weight:600;">
                    A few things we can pick up on:
                  </p>
                  <ul style="margin:0;padding:0 0 0 16px;color:#8b949e;font-size:14px;line-height:2;">
                    <li>Where things stand with your evaluation</li>
                    <li>Any new requirements or blockers on your side</li>
                    <li>Next steps to move things forward</li>
                  </ul>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 28px;font-size:15px;color:#8b949e;line-height:1.7;">
              Even a quick "not right now" helps me keep things organised on my end —
              either way, I appreciate your time.
            </p>

            <a href="mailto:${ownerEmail}?subject=Re: ${encodeURIComponent(dealTitle)}"
               style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;
                      font-size:15px;font-weight:700;padding:13px 28px;border-radius:8px;
                      box-shadow:0 4px 16px rgba(59,130,246,0.3);">
              Reply to ${ownerName}
            </a>
          </td>
        </tr>
        <tr>
          <td style="background:#161b22;padding:20px 36px 28px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0 0 2px;font-size:13px;color:#4a5568;">Warm regards,</p>
            <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#e6edf3;">${ownerName}</p>
            <p style="margin:0;font-size:12px;color:#4a5568;">
              Sales · Teamgrid &nbsp;|&nbsp;
              <a href="mailto:${ownerEmail}" style="color:#3b82f6;text-decoration:none;">${ownerEmail}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#0d1117;border-radius:0 0 12px 12px;padding:16px 36px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="margin:0;font-size:11px;color:#4a5568;">© 2026 Teamgrid CRM</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core stale-deal processor — shared by cron job AND manual re-engage endpoint
// ─────────────────────────────────────────────────────────────────────────────
async function processStaleDeals(deals) {
  const dashboardUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const results = { processed: 0, alerted: 0, errors: [] };

  for (const deal of deals) {
    try {
      // Mark stale
      deal.isStale = true;
      await deal.save();

      const ownerName  = deal.assignedTo?.name  || 'Team';
      const ownerEmail = deal.assignedTo?.email  || null;
      const contactName  = deal.contact?.name  || 'there';
      const contactEmail = deal.contact?.email || null;
      const contactFirstName = contactName.split(' ')[0];
      const daysSince = Math.floor((Date.now() - deal.lastActivityAt) / 86400000);

      // 1. Slack alert to team
      await sendSlackNotification(
        `🥶 *Stale Deal Alert* — "${deal.title}" owned by *${ownerName}* has been inactive for *${daysSince} days*. Tagged as Stale in pipeline.`
      );

      // 2. Email alert to deal owner
      if (ownerEmail) {
        await sendEmailNotification(
          ownerEmail,
          `⚠️ Stale Deal: "${deal.title}" — ${daysSince} days inactive`,
          staleOwnerAlertHtml({ ownerName, dealTitle: deal.title, contactName, daysSince, dashboardUrl })
        );
      }

      // 3. Re-engagement email to contact
      if (contactEmail) {
        await sendEmailNotification(
          contactEmail,
          `Checking in — ${deal.title}`,
          staleContactReEngageHtml({
            contactFirstName,
            dealTitle: deal.title,
            ownerName,
            ownerEmail: ownerEmail || 'team@teamgrid.com',
          })
        );
      }

      results.processed++;
      results.alerted++;
    } catch (err) {
      console.error(`[staleDeals] Error processing deal ${deal._id}:`, err.message);
      results.errors.push({ dealId: deal._id, error: err.message });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// staleDealsJob — daily at 9 AM
// ─────────────────────────────────────────────────────────────────────────────
cron.schedule('0 9 * * *', async () => {
  console.log('[Cron] Running staleDealsJob...');
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const staleDeals = await Deal.find({
      lastActivityAt: { $lt: fourteenDaysAgo },
      isStale: false,
      stage: { $nin: ['closed-won', 'closed-lost'] },
    })
      .populate('assignedTo', 'name email')
      .populate('contact', 'name email company');

    if (staleDeals.length === 0) {
      console.log('[staleDealsJob] No new stale deals found.');
      return;
    }

    console.log(`[staleDealsJob] Found ${staleDeals.length} stale deals — processing...`);
    const results = await processStaleDeals(staleDeals);
    console.log(`[staleDealsJob] Done. Processed: ${results.processed}, Alerts sent: ${results.alerted}`);
  } catch (error) {
    console.error('[staleDealsJob] Fatal error:', error);
  }
});

// renewalReminderJob - daily at 8 AM
cron.schedule('0 8 * * *', async () => {
  console.log('[Cron] Running renewalReminderJob...');
  try {
    const { processRenewalReminders } = require('../services/renewalService');
    const results = await processRenewalReminders();
    console.log(`[renewalReminderJob] Done. Sent: ${results.processed}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`);
  } catch (error) {
    console.error('[renewalReminderJob] Fatal error:', error);
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

module.exports = { processStaleDeals };