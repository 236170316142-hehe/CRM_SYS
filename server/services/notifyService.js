const axios = require('axios');
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const sendSlackNotification = async (message) => {
  try {
    if (!process.env.SLACK_WEBHOOK_URL) return;
    await axios.post(process.env.SLACK_WEBHOOK_URL, {
      text: message,
    });
  } catch (error) {
    console.error('Error sending Slack notification:', error);
  }
};

const sendEmailNotification = async (to, subject, html) => {
  try {
    if (!resend) {
      console.log(`[Email Mock] To: ${to}, Subject: ${subject}`);
      return;
    }
    await resend.emails.send({
      from: 'alerts@resend.dev',
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
};

module.exports = {
  sendSlackNotification,
  sendEmailNotification,
};
