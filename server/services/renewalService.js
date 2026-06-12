/**
 * renewalService.js
 *
 * Handles contract renewal reminders at T-90, T-60, T-30 days.
 * - Sends branded HTML email to the account manager (internal alert)
 * - Sends branded HTML email to the client contact (external reminder)
 * - Logs a contract_renewal activity on the contract
 * - Marks the milestone as sent on the contract (prevents duplicates)
 */

const Contract  = require('../models/Contract');
const Activity  = require('../models/Activity');
const User      = require('../models/User');
const { sendSlackNotification, sendEmailNotification } = require('./notifyService');

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}

// ── Urgency config per milestone ──────────────────────────────────────────
const URGENCY = {
  90: { color: '#3b82f6', label: '90 Days',  tone: 'heads-up',  emoji: '📅' },
  60: { color: '#f59e0b', label: '60 Days',  tone: 'important', emoji: '⏰' },
  30: { color: '#ef4444', label: '30 Days',  tone: 'urgent',    emoji: '🚨' },
};

// ── Internal alert to account manager ─────────────────────────────────────
function repAlertHtml({ repName, contractTitle, contactName, dealTitle, endDate, daysLeft, contractValue, dashboardUrl, milestone }) {
  const u = URGENCY[milestone] || URGENCY[30];
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:32px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
  <tr><td style="background:#161b22;border-radius:12px 12px 0 0;padding:24px 36px;border-bottom:3px solid ${u.color};">
    <span style="font-size:18px;font-weight:800;color:${u.color};">⚡ Teamgrid CRM</span>
    <span style="font-size:13px;color:#8b949e;margin-left:12px;">Contract Renewal Alert</span>
  </td></tr>
  <tr><td style="background:#161b22;padding:32px 36px;">
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#e6edf3;">
      ${u.emoji} Contract Renewal in <span style="color:${u.color};">${u.label}</span>
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#8b949e;line-height:1.7;">
      Hi ${repName}, the following contract is coming up for renewal. 
      ${milestone <= 30 ? '<strong style="color:#ef4444;">Action required — reach out today.</strong>' : 'Please start the renewal conversation soon.'}
    </p>
    <table width="100%" cellpadding="14" cellspacing="0"
           style="background:#1c2330;border:1px solid rgba(${milestone<=30?'239,68,68':milestone<=60?'245,158,11':'59,130,246'},0.2);border-radius:10px;margin-bottom:24px;">
      <tr><td style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:4px;">Contract</div>
        <div style="font-size:15px;font-weight:700;color:#e6edf3;">${contractTitle}</div>
      </td></tr>
      <tr><td style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:4px;">Client</div>
        <div style="font-size:15px;color:#c9d1d9;">${contactName}</div>
      </td></tr>
      <tr><td style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:4px;">Deal</div>
        <div style="font-size:15px;color:#c9d1d9;">${dealTitle}</div>
      </td></tr>
      <tr><td style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:4px;">Contract Value</div>
        <div style="font-size:15px;font-weight:700;color:#3b82f6;">${formatCurrency(contractValue)}</div>
      </td></tr>
      <tr><td>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:4px;">End Date</div>
        <div style="font-size:15px;font-weight:700;color:${u.color};">${formatDate(endDate)} (${daysLeft} days)</div>
      </td></tr>
    </table>
    <a href="${dashboardUrl}/pipeline"
       style="display:inline-block;background:${u.color};color:#ffffff;text-decoration:none;
              font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;">
      View in Pipeline →
    </a>
  </td></tr>
  <tr><td style="background:#0d1117;border-radius:0 0 12px 12px;padding:16px 36px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
    <p style="margin:0;font-size:11px;color:#4a5568;">© 2026 Teamgrid CRM · Automated Renewal Alert</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}

// ── External reminder to client ────────────────────────────────────────────
function clientReminderHtml({ contactFirstName, contractTitle, dealTitle, endDate, daysLeft, repName, repEmail, milestone }) {
  const u = URGENCY[milestone] || URGENCY[30];
  const urgencyMsg = {
    90: `We wanted to give you plenty of notice that your contract is coming up for renewal in 90 days.`,
    60: `Your contract is approaching its renewal date in 60 days — we'd love to connect and discuss how it's been going.`,
    30: `Your contract expires in just 30 days. To ensure there's no interruption to your service, we'd love to schedule a quick call this week.`,
  };
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:32px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
  <tr><td style="background:#161b22;border-radius:12px 12px 0 0;padding:24px 36px;border-bottom:3px solid ${u.color};">
    <span style="font-size:18px;font-weight:800;color:#3b82f6;">⚡ Teamgrid CRM</span>
  </td></tr>
  <tr><td style="background:#161b22;padding:36px;">
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;">
      ${u.emoji} Your contract renews in ${u.label}, ${contactFirstName}
    </h2>
    <p style="margin:0 0 20px;font-size:15px;color:#8b949e;line-height:1.8;">
      ${urgencyMsg[milestone] || urgencyMsg[30]}
    </p>
    <table width="100%" cellpadding="14" cellspacing="0"
           style="background:rgba(${milestone<=30?'239,68,68':milestone<=60?'245,158,11':'59,130,246'},0.06);
                  border:1px solid rgba(${milestone<=30?'239,68,68':milestone<=60?'245,158,11':'59,130,246'},0.15);
                  border-radius:10px;margin-bottom:28px;">
      <tr><td style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Contract</span><br/>
        <span style="font-size:15px;font-weight:700;color:#e6edf3;">${contractTitle}</span>
      </td></tr>
      <tr><td>
        <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Expiry Date</span><br/>
        <span style="font-size:18px;font-weight:800;color:${u.color};">${formatDate(endDate)}</span>
        <span style="font-size:13px;color:#8b949e;margin-left:8px;">(${daysLeft} days from today)</span>
      </td></tr>
    </table>
    <p style="margin:0 0 28px;font-size:15px;color:#8b949e;line-height:1.7;">
      Your account manager ${repName} will be in touch soon, but feel free to reach out directly to get the ball rolling.
    </p>
    <a href="mailto:${repEmail}?subject=Re: Contract Renewal — ${encodeURIComponent(contractTitle)}"
       style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;
              font-size:15px;font-weight:700;padding:13px 28px;border-radius:8px;
              box-shadow:0 4px 16px rgba(59,130,246,0.3);">
      Contact ${repName}
    </a>
  </td></tr>
  <tr><td style="background:#161b22;padding:20px 36px 24px;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0 0 2px;font-size:13px;color:#4a5568;">Warm regards,</p>
    <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#e6edf3;">${repName}</p>
    <p style="margin:0;font-size:12px;color:#4a5568;">
      Teamgrid CRM &nbsp;|&nbsp;
      <a href="mailto:${repEmail}" style="color:#3b82f6;text-decoration:none;">${repEmail}</a>
    </p>
  </td></tr>
  <tr><td style="background:#0d1117;border-radius:0 0 12px 12px;padding:16px 36px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
    <p style="margin:0;font-size:11px;color:#4a5568;">© 2026 Teamgrid CRM</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}

// ── Main processor ─────────────────────────────────────────────────────────
async function processRenewalReminders() {
  const dashboardUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const MILESTONES   = [90, 60, 30];
  const results      = { processed: 0, skipped: 0, errors: [] };

  // Find the system admin for fallback performedBy on activities
  const systemUser = await User.findOne({ role: 'admin' });

  for (const days of MILESTONES) {
    const targetStart = new Date();
    targetStart.setDate(targetStart.getDate() + days);
    targetStart.setHours(0, 0, 0, 0);

    const targetEnd = new Date(targetStart);
    targetEnd.setHours(23, 59, 59, 999);

    const contracts = await Contract.find({
      endDate:  { $gte: targetStart, $lte: targetEnd },
      status:   'active',
      remindersSent: { $nin: [days] },  // not yet sent for this milestone
    }).populate({
      path: 'deal',
      populate: { path: 'assignedTo contact' },
    }).populate('contact');

    for (const contract of contracts) {
      try {
        const deal    = contract.deal;
        const rep     = deal?.assignedTo;
        // Prefer the contract's direct contact, fall back to deal's contact
        const contact = contract.contact || deal?.contact;

        if (!rep || !contact) {
          console.warn(`[Renewal] Skipping contract ${contract._id} — missing rep or contact`);
          results.skipped++;
          continue;
        }

        const daysLeft       = days;
        const contactFirst   = contact.name?.split(' ')[0] || 'there';
        const repEmail       = rep.email;
        const contactEmail   = contact.email;
        const contractTitle  = contract.title || deal?.title || 'Your Contract';
        const dealTitle      = deal?.title || 'N/A';
        const u              = URGENCY[days];

        // 1. Slack alert
        await sendSlackNotification(
          `${u.emoji} *Contract Renewal — ${u.label}* | "${contractTitle}" for *${contact.name}* expires on *${formatDate(contract.endDate)}*. Owner: *${rep.name}*`
        );

        // 2. Internal rep alert email
        if (repEmail) {
          await sendEmailNotification(
            repEmail,
            `${u.emoji} Contract Renewal in ${u.label}: "${contractTitle}"`,
            repAlertHtml({
              repName: rep.name,
              contractTitle,
              contactName: contact.name,
              dealTitle,
              endDate: contract.endDate,
              daysLeft,
              contractValue: contract.value || deal?.value || 0,
              dashboardUrl,
              milestone: days,
            })
          );
        }

        // 3. External client reminder email
        if (contactEmail) {
          await sendEmailNotification(
            contactEmail,
            `${u.emoji} Your contract renews in ${u.label} — ${contractTitle}`,
            clientReminderHtml({
              contactFirstName: contactFirst,
              contractTitle,
              dealTitle,
              endDate: contract.endDate,
              daysLeft,
              repName:  rep.name,
              repEmail: repEmail || 'team@teamgrid.com',
              milestone: days,
            })
          );
        }

        // 4. Log activity on the contract
        await Activity.create({
          type:       'contract_renewal',
          outcome:    `Renewal reminder sent — ${days} days before expiry (${formatDate(contract.endDate)})`,
          relatedTo:  contract._id,
          onModel:    'Contract',
          performedBy: rep._id || systemUser?._id,
        });

        // 5. Mark this milestone as sent to prevent re-sending
        await Contract.findByIdAndUpdate(contract._id, {
          $addToSet: { remindersSent: days },
        });

        console.log(`[Renewal] Sent ${days}-day reminder for "${contractTitle}" → rep:${repEmail} client:${contactEmail}`);
        results.processed++;
      } catch (err) {
        console.error(`[Renewal] Error on contract ${contract._id}:`, err.message);
        results.errors.push({ contractId: contract._id, error: err.message });
      }
    }
  }

  return results;
}

module.exports = { processRenewalReminders };
