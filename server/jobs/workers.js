const { Worker } = require('bullmq');
const redisClient = require('../config/redis');
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const emailWorker = new Worker('welcomeEmailQueue', async job => {
  const { email, firstName, company, sequenceDay } = job.data;
  
  let subject = '';
  let html = '';

  if (sequenceDay === 0) {
    subject = `Welcome to our CRM, ${firstName}!`;
    html = `<p>Hi ${firstName},</p><p>Thanks for showing interest from ${company}. We're excited to have you.</p>`;
  } else if (sequenceDay === 2) {
    subject = `Checking in, ${firstName}`;
    html = `<p>Hi ${firstName},</p><p>It's been a couple of days. How are things at ${company}?</p>`;
  } else if (sequenceDay === 5) {
    subject = `Let's connect, ${firstName}`;
    html = `<p>Hi ${firstName},</p><p>We would love to schedule a demo for ${company}. Let us know when you're free.</p>`;
  }

  try {
    if (resend) {
      await resend.emails.send({
        from: 'onboarding@resend.dev', // Use a verified domain or resend.dev for testing
        to: email,
        subject,
        html,
      });
      console.log(`Sent sequence day ${sequenceDay} email to ${email}`);
    } else {
      console.log(`[Email Mock] Sent sequence day ${sequenceDay} email to ${email}`);
    }
  } catch (error) {
    console.error(`Error sending email to ${email}:`, error);
    throw error;
  }
}, { connection: redisClient });

emailWorker.on('completed', job => {
  console.log(`Job with id ${job.id} has been completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Job with id ${job.id} has failed with ${err.message}`);
});

module.exports = emailWorker;
