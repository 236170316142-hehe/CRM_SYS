/**
 * assignmentService.js
 *
 * Single source of truth for auto-assigning leads to reps.
 * Used by both leads.js and webhooks.js so the logic is never duplicated.
 */

const User = require('../models/User');
const AssignmentRule = require('../models/AssignmentRule');

/**
 * Pick the next rep in round-robin order for the given pointer key,
 * persist the pointer back to MongoDB, and return the chosen rep.
 *
 * FIX: call rule.markModified('lastAssigned') before save() so Mongoose
 * flushes the Mixed-type nested object to the database. Without this the
 * pointer never advances and the same rep always gets picked.
 */
async function pickNext(rule, reps, pointerKey) {
  if (!reps || reps.length === 0) return null;

  // Deterministic order so every server instance agrees on the rotation
  reps.sort((a, b) => a._id.toString().localeCompare(b._id.toString()));

  // Ensure lastAssigned is always a plain object (guard against legacy data)
  if (!rule.lastAssigned || typeof rule.lastAssigned !== 'object' || Array.isArray(rule.lastAssigned)) {
    rule.lastAssigned = {};
  }

  const lastId = rule.lastAssigned[pointerKey] || null;

  let idx = 0;
  if (lastId) {
    const found = reps.findIndex(r => r._id.toString() === lastId.toString());
    // If found, advance by 1; if the stored id no longer exists (rep deleted), start from 0
    idx = found >= 0 ? (found + 1) % reps.length : 0;
  }

  const chosen = reps[idx];

  // Persist the pointer
  rule.lastAssigned[pointerKey] = chosen._id;
  rule.markModified('lastAssigned'); // ← critical: tells Mongoose the Mixed field changed
  await rule.save();

  return chosen;
}

/**
 * Auto-assign a rep based on the active assignment rule.
 * @param {string|null} territory  Optional territory string from the lead
 * @returns {mongoose.Document|null} The chosen User doc, or null if no reps exist
 */
async function autoAssignRep(territory = null) {
  let rule = await AssignmentRule.findOne();
  if (!rule) {
    rule = await AssignmentRule.create({ type: 'round_robin', lastAssigned: {} });
  }

  if (rule.type === 'round_robin') {
    const reps = await User.find({ role: 'rep', approved: true });
    return pickNext(rule, reps, 'global');
  }

  if (rule.type === 'territory') {
    // Try territory-specific pool first, fall back to all reps
    let reps = territory
      ? await User.find({ role: 'rep', approved: true, territory })
      : [];

    if (reps.length === 0) {
      reps = await User.find({ role: 'rep', approved: true });
    }

    const pointerKey = territory || 'global';
    return pickNext(rule, reps, pointerKey);
  }

  // Unknown rule type — random fallback
  const reps = await User.find({ role: 'rep', approved: true });
  return reps.length > 0 ? reps[Math.floor(Math.random() * reps.length)] : null;
}

module.exports = { autoAssignRep };
