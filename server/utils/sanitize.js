/**
 * sanitize.js — shared input sanitisation helpers
 */

/**
 * Validates and cleans a phone number string.
 * Allows: digits, spaces, +, -, (, )
 * Min 7 digits, max 20 chars after stripping formatting.
 *
 * Returns { valid: boolean, cleaned: string, reason: string|null }
 */
function sanitizePhone(phone) {
  if (!phone || phone.trim() === '') {
    return { valid: true, cleaned: '', reason: null }; // phone is optional
  }

  const trimmed = phone.trim();

  // Only allow digits, spaces, +, -, (, )
  if (!/^[\+\-\s\(\)\d]+$/.test(trimmed)) {
    return {
      valid: false,
      cleaned: '',
      reason: 'Phone number can only contain digits, spaces, +, -, and parentheses.',
    };
  }

  // Check digit count (strip formatting, count digits only)
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length < 7) {
    return {
      valid: false,
      cleaned: '',
      reason: 'Phone number must have at least 7 digits.',
    };
  }
  if (digitsOnly.length > 15) {
    return {
      valid: false,
      cleaned: '',
      reason: 'Phone number must not exceed 15 digits.',
    };
  }

  return { valid: true, cleaned: trimmed, reason: null };
}

module.exports = { sanitizePhone };
