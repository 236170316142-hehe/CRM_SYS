/**
 * dripService.js
 *
 * Central service for enrolling leads into email drip sequences.
 *
 * Sequences
 * ─────────────────────────────────────────────────────────────
 * NEW_LEAD      → welcomeEmailQueue  → Day 0 / 2 / 5
 * DEMO_REQUESTED → demoEmailQueue    → Day 0 / 3 / 7
 *
 * Usage
 * ─────────────────────────────────────────────────────────────
 * const { enrollNewLead, enrollDemoRequested } = require('./dripService');
 * await enrollNewLead(lead, repUser);
 * await enrollDemoRequested(lead, repUser);
 */

const { welcomeEmailQueue, demoEmailQueue } = require('../jobs/queues');

const DAY = 24 * 60 * 60 * 1000; // ms

/**
 * Build the common job payload from a lead + optional rep.
 */
function buildPayload(lead, repUser) {
  return {
    email:     lead.email,
    firstName: lead.name.split(' ')[0],
    company:   lead.company || 'your company',
    repName:   repUser?.name  || null,
    repEmail:  repUser?.email || null,
  };
}

/**
 * Enroll a lead in the NEW LEAD drip sequence.
 * Trigger: lead created with status = 'new'
 *
 * Day 0 — Welcome & intro
 * Day 2 — Check-in with social proof stats
 * Day 5 — Final nudge / CTA
 */
async function enrollNewLead(lead, repUser = null) {
  const payload = buildPayload(lead, repUser);
  const leadId  = lead._id.toString();

  await Promise.all([
    welcomeEmailQueue.add(
      `new-lead-day0-${leadId}`,
      { ...payload, sequenceDay: 0 },
      { jobId: `new-lead-day0-${leadId}` }           // idempotent
    ),
    welcomeEmailQueue.add(
      `new-lead-day2-${leadId}`,
      { ...payload, sequenceDay: 2 },
      { delay: 2 * DAY, jobId: `new-lead-day2-${leadId}` }
    ),
    welcomeEmailQueue.add(
      `new-lead-day5-${leadId}`,
      { ...payload, sequenceDay: 5 },
      { delay: 5 * DAY, jobId: `new-lead-day5-${leadId}` }
    ),
  ]);

  console.log(`[dripService] Enrolled "${lead.email}" in NEW_LEAD sequence`);
}

/**
 * Enroll a lead in the DEMO REQUESTED drip sequence.
 * Trigger: lead status changes to 'contacted' (demo requested stage)
 *
 * Day 0 — Demo confirmed + prep checklist
 * Day 3 — Pre-demo resources
 * Day 7 — Post-demo follow-up & proposal prompt
 */
async function enrollDemoRequested(lead, repUser = null) {
  const payload = buildPayload(lead, repUser);
  const leadId  = lead._id.toString();

  await Promise.all([
    demoEmailQueue.add(
      `demo-day0-${leadId}`,
      { ...payload, sequenceDay: 0 },
      { jobId: `demo-day0-${leadId}` }
    ),
    demoEmailQueue.add(
      `demo-day3-${leadId}`,
      { ...payload, sequenceDay: 3 },
      { delay: 3 * DAY, jobId: `demo-day3-${leadId}` }
    ),
    demoEmailQueue.add(
      `demo-day7-${leadId}`,
      { ...payload, sequenceDay: 7 },
      { delay: 7 * DAY, jobId: `demo-day7-${leadId}` }
    ),
  ]);

  console.log(`[dripService] Enrolled "${lead.email}" in DEMO_REQUESTED sequence`);
}

module.exports = { enrollNewLead, enrollDemoRequested };
