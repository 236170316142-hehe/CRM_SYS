const User = require('../models/User');
const Activity = require('../models/Activity');
const Contact = require('../models/Contact');
const { sendSlackNotification, sendEmailNotification } = require('./notifyService');
const { generateAndSendProposal } = require('./proposalService');

const STAGE_LABELS = {
  prospect: 'Prospect',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  'closed-won': 'Closed Won',
  'closed-lost': 'Closed Lost',
};

const STAGE_ORDER = ['prospect', 'proposal', 'negotiation', 'closed-won', 'closed-lost'];

function classifyTransition(oldStage, newStage) {
  if (newStage === 'closed-won') return 'won';
  if (newStage === 'closed-lost') return 'lost';
  const oldIdx = STAGE_ORDER.indexOf(oldStage);
  const newIdx = STAGE_ORDER.indexOf(newStage);
  if (newIdx > oldIdx) return 'advance';
  if (newIdx < oldIdx) return 'regression';
  return 'no-change';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

function buildSlackMessage(deal, oldStage, newStage, transitionType, userName) {
  const fromLabel = STAGE_LABELS[oldStage] || oldStage;
  const toLabel = STAGE_LABELS[newStage] || newStage;

  let emoji = '📊';
  if (transitionType === 'won') emoji = '🎉';
  else if (transitionType === 'lost') emoji = '❌';
  else if (transitionType === 'advance') emoji = '🚀';
  else if (transitionType === 'regression') emoji = '🔙';

  return `${emoji} *Deal Stage Changed*\n\n`
    + `*Deal:* ${deal.title}\n`
    + `*Value:* ${formatCurrency(deal.value)}\n`
    + `*Owner:* ${userName}\n`
    + `*From:* ${fromLabel}  →  *To:* ${toLabel}\n`
    + `*Transition:* ${transitionType === 'won' ? 'Closed Won 🎉' : transitionType === 'lost' ? 'Closed Lost ❌' : transitionType === 'advance' ? 'Advanced 🚀' : 'Moved Back 🔙'}`;
}

function buildEmailHtml(deal, oldStage, newStage, transitionType, userName) {
  const fromLabel = STAGE_LABELS[oldStage] || oldStage;
  const toLabel = STAGE_LABELS[newStage] || newStage;

  let badgeColor = '#3b82f6';
  let badgeText = 'Stage Updated';
  if (transitionType === 'won') { badgeColor = '#22c55e'; badgeText = 'Deal Won 🎉'; }
  else if (transitionType === 'lost') { badgeColor = '#ef4444'; badgeText = 'Deal Lost'; }
  else if (transitionType === 'advance') { badgeColor = '#3b82f6'; badgeText = 'Advanced 🚀'; }
  else if (transitionType === 'regression') { badgeColor = '#f59e0b'; badgeText = 'Moved Back'; }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#161b22;border-radius:12px 12px 0 0;padding:28px 40px;border-bottom:3px solid ${badgeColor};">
            <span style="font-size:20px;font-weight:800;color:#e6edf3;">⚡ Teamgrid CRM</span>
          </td>
        </tr>
        <tr>
          <td style="background:#161b22;padding:40px;">
            <h2 style="margin:0 0 24px;font-size:20px;font-weight:800;color:#e6edf3;">${badgeText}</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="padding:12px 16px;background:#1c2330;border-radius:8px;border-left:3px solid ${badgeColor};">
                  <table width="100%">
                    <tr><td style="color:#8b949e;font-size:13px;padding-bottom:4px;">Deal</td>
                        <td style="color:#e6edf3;font-size:15px;font-weight:600;text-align:right;">${deal.title}</td></tr>
                    <tr><td style="color:#8b949e;font-size:13px;padding-bottom:4px;">Value</td>
                        <td style="color:#e6edf3;font-size:15px;font-weight:600;text-align:right;">${formatCurrency(deal.value)}</td></tr>
                    <tr><td style="color:#8b949e;font-size:13px;padding-bottom:4px;">Owner</td>
                        <td style="color:#e6edf3;font-size:15px;font-weight:600;text-align:right;">${userName}</td></tr>
                    <tr><td style="color:#8b949e;font-size:13px;padding-bottom:4px;">From</td>
                        <td style="color:#e6edf3;font-size:15px;font-weight:600;text-align:right;">${fromLabel}</td></tr>
                    <tr><td style="color:#8b949e;font-size:13px;">To</td>
                        <td style="color:#e6edf3;font-size:15px;font-weight:600;text-align:right;">${toLabel}</td></tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#4a5568;line-height:1.6;">
              This is an automated alert from Teamgrid CRM. View the deal in your dashboard for more details.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#0d1117;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:12px;color:#4a5568;">© 2026 Teamgrid CRM · Automated deal alert</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function notifyDealStageChange(deal, oldStage, newStage, performedBy) {
  if (oldStage === newStage) return;

  const transitionType = classifyTransition(oldStage, newStage);
  const userName = performedBy?.name || deal.assignedTo?.name || 'Unknown';

  const slackMessage = buildSlackMessage(deal, oldStage, newStage, transitionType, userName);
  const emailHtml = buildEmailHtml(deal, oldStage, newStage, transitionType, userName);

  await sendSlackNotification(slackMessage);

  const subject = `Deal Update: ${deal.title} moved to ${STAGE_LABELS[newStage] || newStage}`;
  const recipients = [];

  if (deal.assignedTo?.email) {
    recipients.push(deal.assignedTo.email);
  }

  if (performedBy?.email && performedBy.email !== deal.assignedTo?.email) {
    recipients.push(performedBy.email);
  }

  const managers = await User.find({ role: { $in: ['admin', 'manager'] } });
  for (const m of managers) {
    if (!recipients.includes(m.email)) {
      recipients.push(m.email);
    }
  }

  for (const email of recipients) {
    await sendEmailNotification(email, subject, emailHtml);
  }

  try {
    await Activity.create({
      type: 'stage_change',
      outcome: `${STAGE_LABELS[oldStage] || oldStage} → ${STAGE_LABELS[newStage] || newStage}`,
      relatedTo: deal._id,
      onModel: 'Deal',
      performedBy: performedBy?._id || deal.assignedTo?._id,
    });
  } catch (err) {
    console.error('[DealAlert] Failed to log activity:', err.message);
  }

  // ── Auto-generate proposal when deal moves to Proposal stage ─────────
  if (newStage === 'proposal') {
    // Run async — don't block the API response
    setImmediate(async () => {
      try {
        const fullDeal = await require('../models/Deal').findById(deal._id)
          .populate('contact')
          .populate('assignedTo', 'name email');

        const contact = fullDeal?.contact;
        const rep     = fullDeal?.assignedTo;

        if (!contact?.email) {
          console.warn('[Proposal] No contact email — skipping proposal generation');
          return;
        }

        const result = await generateAndSendProposal(fullDeal, contact, rep);

        // Save proposal metadata on the deal
        await require('../models/Deal').findByIdAndUpdate(deal._id, {
          proposalStatus: result.status,
          proposalSentAt: new Date(),
          pandaDocId:     result.pandaDocId,
          proposalUrl:    result.proposalUrl,
        });

        console.log(`[Proposal] Deal ${deal._id} updated with proposalStatus=sent`);
      } catch (err) {
        console.error('[Proposal] Auto-generation failed:', err.message);
        // Mark as failed so UI can show retry
        await require('../models/Deal').findByIdAndUpdate(deal._id, { proposalStatus: 'none' });
      }
    });
  }
}

module.exports = { notifyDealStageChange };
