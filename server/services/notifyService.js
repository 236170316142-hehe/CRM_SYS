const axios = require('axios');
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

// ── Slack ──────────────────────────────────────────────────────────────────
const sendSlackNotification = async (message) => {
  try {
    if (!process.env.SLACK_WEBHOOK_URL) return;
    await axios.post(process.env.SLACK_WEBHOOK_URL, { text: message });
  } catch (error) {
    console.error('[Slack] Error sending notification:', error.message);
  }
};

// ── Email ──────────────────────────────────────────────────────────────────
const sendEmailNotification = async (to, subject, html) => {
  try {
    if (gmailTransport) {
      await gmailTransport.sendMail({ from: FROM_ADDRESS, to, subject, html });
      console.log(`[Gmail SMTP] Sent to: ${to} | Subject: ${subject}`);
      return;
    }

    if (resend) {
      await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
      console.log(`[Resend] Sent to: ${to} | Subject: ${subject}`);
      return;
    }

    // No transport configured — log only
    console.log(`[Email Mock] To: ${to} | Subject: ${subject}`);
  } catch (error) {
    console.error(`[Email] Failed to send to ${to}:`, error.message);
  }
};

module.exports = { sendSlackNotification, sendEmailNotification };
