const { Worker } = require('bullmq');
const redisClient = require('../config/redis');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// ── Transport priority: Gmail SMTP → Resend → mock log ────────────────────
let gmailTransport = null;
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  gmailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

const resend = (!gmailTransport && process.env.RESEND_API_KEY)
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS = process.env.EMAIL_FROM || `Teamgrid CRM <${process.env.GMAIL_USER || 'onboarding@resend.dev'}>`;

// ─────────────────────────────────────────────────────────────────────────────
// HTML email builder – shared shell with personalisation tokens
// ─────────────────────────────────────────────────────────────────────────────
function buildEmail({ previewText, headline, body, ctaLabel, ctaUrl, repName, repEmail }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#e6edf3;">
  <!-- Preview text (hidden) -->
  <span style="display:none;max-height:0;overflow:hidden;">${previewText}</span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d1117;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#161b22;border-radius:12px 12px 0 0;padding:28px 40px;border-bottom:3px solid #3b82f6;">
              <span style="font-size:22px;font-weight:800;background:linear-gradient(135deg,#3b82f6,#6366f1);-webkit-background-clip:text;color:#3b82f6;letter-spacing:-0.5px;">
                ⚡ Teamgrid CRM
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#161b22;padding:40px 40px 32px;">
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;line-height:1.2;">
                ${headline}
              </h1>
              ${body}
            </td>
          </tr>

          <!-- CTA -->
          ${ctaLabel && ctaUrl ? `
          <tr>
            <td style="background:#161b22;padding:0 40px 40px;text-align:center;">
              <a href="${ctaUrl}"
                 style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;
                        font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;
                        box-shadow:0 4px 20px rgba(59,130,246,0.35);">
                ${ctaLabel}
              </a>
            </td>
          </tr>` : ''}

          <!-- Rep signature -->
          ${repName ? `
          <tr>
            <td style="background:#161b22;padding:0 40px 40px;">
              <table cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(255,255,255,0.08);padding-top:24px;width:100%;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:14px;color:#8b949e;">Warm regards,</p>
                    <p style="margin:6px 0 2px;font-size:15px;font-weight:700;color:#e6edf3;">${repName}</p>
                    <p style="margin:0;font-size:13px;color:#8b949e;">Sales Representative · Teamgrid</p>
                    ${repEmail ? `<p style="margin:4px 0 0;font-size:13px;"><a href="mailto:${repEmail}" style="color:#3b82f6;text-decoration:none;">${repEmail}</a></p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="background:#0d1117;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:#4a5568;line-height:1.6;">
                You're receiving this because you signed up at Teamgrid.<br/>
                <a href="#" style="color:#3b82f6;text-decoration:none;">Unsubscribe</a> &nbsp;·&nbsp;
                <a href="#" style="color:#3b82f6;text-decoration:none;">Privacy Policy</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email templates — New Lead sequence (trigger: status = 'new')
// ─────────────────────────────────────────────────────────────────────────────
function newLeadTemplate(day, { firstName, company, repName, repEmail }) {
  const crmUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const templates = {
    0: {
      subject: `Welcome to Teamgrid, ${firstName}! 👋`,
      previewText: `We received your details and a rep has been assigned to you.`,
      headline: `Great to meet you, ${firstName}!`,
      body: `
        <p style="margin:0 0 16px;font-size:16px;color:#c9d1d9;line-height:1.7;">
          Thanks for reaching out. We've added you to our CRM and one of our team members
          will be in touch with you shortly.
        </p>
        <p style="margin:0 0 16px;font-size:16px;color:#c9d1d9;line-height:1.7;">
          In the meantime, here's what you can expect:
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;">
          ${['A personalised intro call to understand your needs',
             'A tailored demo of Teamgrid built around your workflow',
             'A clear proposal with transparent pricing'].map((item, i) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="display:inline-flex;align-items:center;gap:12px;font-size:15px;color:#c9d1d9;">
                <span style="display:inline-block;width:28px;height:28px;background:rgba(59,130,246,0.12);
                             border-radius:50%;text-align:center;line-height:28px;font-size:13px;
                             font-weight:700;color:#3b82f6;flex-shrink:0;">${i + 1}</span>
                ${item}
              </span>
            </td>
          </tr>`).join('')}
        </table>
        <p style="margin:0;font-size:15px;color:#8b949e;line-height:1.7;">
          Company on file: <strong style="color:#e6edf3;">${company}</strong>
        </p>`,
      ctaLabel: 'Book a Call Now',
      ctaUrl: `${crmUrl}/demo`,
    },
    2: {
      subject: `Quick check-in, ${firstName} 👀`,
      previewText: `Did you get a chance to explore Teamgrid yet?`,
      headline: `How are things going, ${firstName}?`,
      body: `
        <p style="margin:0 0 16px;font-size:16px;color:#c9d1d9;line-height:1.7;">
          It's been a couple of days since you reached out — just wanted to check in and
          see if you had any questions.
        </p>
        <p style="margin:0 0 16px;font-size:16px;color:#c9d1d9;line-height:1.7;">
          Teams like <strong style="color:#e6edf3;">${company}</strong> typically see results in the
          first week after getting set up:
        </p>
        <table cellpadding="16" cellspacing="0" border="0"
               style="width:100%;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.15);
                      border-radius:10px;margin:0 0 24px;">
          <tr>
            <td style="text-align:center;border-right:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:28px;font-weight:800;color:#3b82f6;">3.2×</div>
              <div style="font-size:12px;color:#8b949e;margin-top:4px;">Faster lead response</div>
            </td>
            <td style="text-align:center;border-right:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:28px;font-weight:800;color:#3b82f6;">47%</div>
              <div style="font-size:12px;color:#8b949e;margin-top:4px;">Higher conversions</div>
            </td>
            <td style="text-align:center;">
              <div style="font-size:28px;font-weight:800;color:#3b82f6;">12 min</div>
              <div style="font-size:12px;color:#8b949e;margin-top:4px;">Avg. first contact</div>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:15px;color:#8b949e;line-height:1.7;">
          Just reply to this email if you have any questions — I'm here to help.
        </p>`,
      ctaLabel: 'Schedule a 15-min Demo',
      ctaUrl: `${crmUrl}/demo`,
    },
    5: {
      subject: `Last one, ${firstName} — let's make it count`,
      previewText: `One final nudge before we close the loop on your request.`,
      headline: `Let's make this happen, ${firstName}`,
      body: `
        <p style="margin:0 0 16px;font-size:16px;color:#c9d1d9;line-height:1.7;">
          I don't want to fill your inbox, so this will be my last email in this sequence.
          If this isn't a good time, no worries at all — just reply and I'll follow up
          whenever works for you.
        </p>
        <p style="margin:0 0 24px;font-size:16px;color:#c9d1d9;line-height:1.7;">
          If you're still interested, I'd love to show you exactly how Teamgrid can help
          <strong style="color:#e6edf3;">${company}</strong> close more deals with less
          manual work.
        </p>
        <table cellpadding="0" cellspacing="0" border="0"
               style="width:100%;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);
                      border-radius:10px;padding:20px;margin:0 0 24px;">
          <tr>
            <td style="font-size:15px;color:#c9d1d9;line-height:1.7;">
              💡 <strong style="color:#e6edf3;">Pro tip:</strong> Our average onboarding is
              under 30 minutes and your team can be live the same day.
            </td>
          </tr>
        </table>`,
      ctaLabel: 'Claim Your Free Demo',
      ctaUrl: `${crmUrl}/demo`,
    },
  };

  return templates[day] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email templates — Demo Requested sequence (trigger: status = 'contacted')
// ─────────────────────────────────────────────────────────────────────────────
function demoRequestedTemplate(day, { firstName, company, repName, repEmail }) {
  const crmUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const templates = {
    0: {
      subject: `Demo confirmed, ${firstName} — here's what to expect ✅`,
      previewText: `Your demo request is in. Here's how to get the most out of it.`,
      headline: `You're booked in, ${firstName}!`,
      body: `
        <p style="margin:0 0 16px;font-size:16px;color:#c9d1d9;line-height:1.7;">
          Fantastic news — your demo request has been confirmed. We've reserved time
          specifically to walk through how Teamgrid fits
          <strong style="color:#e6edf3;">${company}</strong>'s workflow.
        </p>
        <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#e6edf3;">
          To make the most of our time, here's a quick prep checklist:
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;">
          ${['Think about your biggest sales bottleneck right now',
             'Note how many reps are on your team',
             'Consider which integrations matter most to you'].map(item => `
          <tr>
            <td style="padding:8px 0;font-size:15px;color:#c9d1d9;border-bottom:1px solid rgba(255,255,255,0.05);">
              <span style="color:#22c55e;margin-right:10px;">✓</span>${item}
            </td>
          </tr>`).join('')}
        </table>`,
      ctaLabel: 'Add to Calendar',
      ctaUrl: `${crmUrl}/calendar`,
    },
    3: {
      subject: `Before our demo — a few things to know, ${firstName}`,
      previewText: `Resources to review before we connect.`,
      headline: `Getting ready for your demo`,
      body: `
        <p style="margin:0 0 16px;font-size:16px;color:#c9d1d9;line-height:1.7;">
          We're looking forward to showing you around. To make our time together more
          productive, here are a few quick resources.
        </p>
        <table cellpadding="16" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;">
          ${[['📊', '2-min product overview', 'See the full pipeline, scoring, and assignment engine in action.'],
             ['🎯', 'Lead routing explained', 'How round-robin and territory rules work out of the box.'],
             ['📬', 'Email automation deep-dive', 'The exact sequences we\'ll set up together for ${company}.']].map(([icon, title, desc]) => `
          <tr>
            <td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);
                       border-radius:8px;padding:16px;margin-bottom:8px;">
              <div style="font-size:22px;margin-bottom:8px;">${icon}</div>
              <div style="font-size:15px;font-weight:700;color:#e6edf3;margin-bottom:4px;">${title}</div>
              <div style="font-size:14px;color:#8b949e;line-height:1.6;">${desc.replace('${company}', company)}</div>
            </td>
          </tr>
          <tr><td style="height:8px;"></td></tr>`).join('')}
        </table>
        <p style="margin:0;font-size:15px;color:#8b949e;">
          Any specific areas you'd like us to focus on? Just reply and let me know.
        </p>`,
      ctaLabel: 'Reply With Your Questions',
      ctaUrl: `mailto:${repEmail || 'team@teamgrid.com'}`,
    },
    7: {
      subject: `${firstName}, how did we do? 🙏`,
      previewText: `Post-demo follow-up from your Teamgrid rep.`,
      headline: `Thanks for your time, ${firstName}`,
      body: `
        <p style="margin:0 0 16px;font-size:16px;color:#c9d1d9;line-height:1.7;">
          It was great connecting with you. I hope the demo gave you a clear picture of
          what Teamgrid can do for <strong style="color:#e6edf3;">${company}</strong>.
        </p>
        <p style="margin:0 0 24px;font-size:16px;color:#c9d1d9;line-height:1.7;">
          To recap the key things we covered:
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;">
          ${['Smart lead routing — zero manual assignment',
             'Automated email sequences that fire on stage changes',
             'Real-time pipeline with lead scoring alerts',
             'Full reporting on rep performance and conversion rates'].map((item, i) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="font-size:15px;color:#c9d1d9;">
                <span style="display:inline-block;width:24px;height:24px;background:rgba(34,197,94,0.12);
                             border-radius:50%;text-align:center;line-height:24px;font-size:12px;
                             font-weight:700;color:#22c55e;margin-right:10px;">${i + 1}</span>
                ${item}
              </span>
            </td>
          </tr>`).join('')}
        </table>
        <p style="margin:0 0 0;font-size:15px;color:#8b949e;line-height:1.7;">
          When you're ready to move forward — or if you have any questions — just hit reply.
          I'll turn around a proposal within 24 hours.
        </p>`,
      ctaLabel: 'Start My Free Trial',
      ctaUrl: `${crmUrl}/register`,
    },
  };

  return templates[day] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared send helper
// ─────────────────────────────────────────────────────────────────────────────
async function dispatchEmail(to, subject, html, sequenceLabel) {
  if (gmailTransport) {
    await gmailTransport.sendMail({ from: FROM_ADDRESS, to, subject, html });
    console.log(`[Gmail SMTP] "${sequenceLabel}" → ${to}`);
    return;
  }
  if (resend) {
    await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
    console.log(`[Resend] "${sequenceLabel}" → ${to}`);
    return;
  }
  console.log(`[Email Mock] "${sequenceLabel}" → ${to} | Subject: ${subject}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker 1: New Lead drip (welcomeEmailQueue)
// ─────────────────────────────────────────────────────────────────────────────
const welcomeWorker = new Worker('welcomeEmailQueue', async (job) => {
  const { email, firstName, company, sequenceDay, repName, repEmail } = job.data;

  const tpl = newLeadTemplate(sequenceDay, { firstName, company, repName, repEmail });
  if (!tpl) {
    console.warn(`[welcomeWorker] No template for day ${sequenceDay}`);
    return;
  }

  const html = buildEmail({ ...tpl, repName, repEmail });
  await dispatchEmail(email, tpl.subject, html, `New Lead Day ${sequenceDay}`);
}, { connection: redisClient });

welcomeWorker.on('completed', (job) => {
  console.log(`[welcomeWorker] Job ${job.id} completed`);
});
welcomeWorker.on('failed', (job, err) => {
  console.error(`[welcomeWorker] Job ${job.id} failed: ${err.message}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Worker 2: Demo Requested drip (demoEmailQueue)
// ─────────────────────────────────────────────────────────────────────────────
const demoWorker = new Worker('demoEmailQueue', async (job) => {
  const { email, firstName, company, sequenceDay, repName, repEmail } = job.data;

  const tpl = demoRequestedTemplate(sequenceDay, { firstName, company, repName, repEmail });
  if (!tpl) {
    console.warn(`[demoWorker] No template for day ${sequenceDay}`);
    return;
  }

  const html = buildEmail({ ...tpl, repName, repEmail });
  await dispatchEmail(email, tpl.subject, html, `Demo Requested Day ${sequenceDay}`);
}, { connection: redisClient });

demoWorker.on('completed', (job) => {
  console.log(`[demoWorker] Job ${job.id} completed`);
});
demoWorker.on('failed', (job, err) => {
  console.error(`[demoWorker] Job ${job.id} failed: ${err.message}`);
});

module.exports = { welcomeWorker, demoWorker };
