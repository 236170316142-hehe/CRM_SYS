/**
 * emailValidationService.js
 *
 * Two-layer email validation:
 *  1. Blocklist  — known disposable/fake email providers
 *  2. MX check   — domain must have real mail exchange records
 *
 * Returns { valid: boolean, reason: string }
 */

const dns = require('dns');

// ── Disposable / throwaway domain blocklist ────────────────────────────────
const BLOCKED_DOMAINS = new Set([
  // Disposable services
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.info',
  'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmail.net',
  'throwam.com', 'throwaway.email', 'dispostable.com', 'yopmail.com',
  'yopmail.fr', 'cool.fr.nf', 'jetable.fr.nf', 'nospam.ze.tc',
  'nomail.xl.cx', 'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf',
  'moncourrier.fr.nf', 'monemail.fr.nf', 'monmail.fr.nf',
  'trashmail.com', 'trashmail.at', 'trashmail.io', 'trashmail.me',
  'trashmail.net', 'trashmail.org', 'trashmail.xyz',
  'sharklasers.com', 'guerrillamailblock.com', 'spam4.me',
  'getnada.com', 'mailnull.com', 'spamgourmet.com', 'maildrop.cc',
  'mailnesia.com', 'discard.email', 'spamfree24.org',
  'spamfree24.de', 'spamfree24.eu', 'spamfree24.info', 'spamfree24.net',
  'spamfree24.org', 'fakeinbox.com', 'mailcatch.com', 'filzmail.com',
  'mailexpire.com', 'spoofmail.de', 'sogetthis.com', 'spamherelots.com',
  'spamhereplease.com', 'herp.in', 'mailme.ir', 'mailme.gq',
  'binkmail.com', 'bob.email', 'clrmail.com', 'dispostable.com',
  'emailondeck.com', 'getonemail.com', 'getonemail.net', 'incognitomail.com',
  'incognitomail.net', 'incognitomail.org', 'kasmail.com', 'klassmaster.com',
  'klassmaster.net', 'kurzepost.de', 'lol.ovpn.to', 'lookugly.com',
  'lortemail.dk', 'mt2009.com', 'mt2014.com', 'nwldx.com', 'objectmail.com',
  'obobbo.com', 'onewaymail.com', 'pookmail.com', 'proxymail.eu',
  'rcpt.at', 's0ny.net', 'smellfear.com', 'snakemail.com',
  'sofimail.com', 'spam.la', 'spamdecoy.net', 'spamfree.eu',
  'spamgoes.in', 'spamspot.com', 'trbvm.com', 'trbvn.com', 'uggsrock.com',
  'upliftnow.com', 'uplipht.com', 'vomoto.com', 'wuzupmail.net',
  'xn--9kq967o.com', 'yep.it', 'zoemail.net', 'zoemail.org',
  'zomg.info', '10minutemail.com', '10minutemail.net', '10minutemail.org',
  '10minutemail.co.uk', '20minutemail.com', '20minutemail.it',
  'mintemail.com', 'minutemail.com', 'mt2015.com', 'mt2016.com',

  // Obviously fake / test domains
  'test.com', 'fake.com', 'example.com', 'sample.com', 'mailtest.com',
  'test.net', 'fake.net', 'test.org', 'fake.org', 'invalid.com',
  'noemail.com', 'noemail.net', 'none.com', 'nomail.com', 'nomail.net',
  'null.com', 'null.net', 'fakemail.com', 'fakedomain.com',
]);

// ── Suspicious pattern detector ────────────────────────────────────────────
// Catches things like aaa@bbb.com, 123@456.com, qwerty@asdf.com
const KEYBOARD_PATTERNS = /^(qwerty|asdfg|asdf|zxcv|abcd|1234|test|admin|noreply|no-reply|donotreply|user|info|hello|example|sample|dummy|placeholder|fake|random|blah|foobar|foo|bar|baz)/i;
const REPEATED_CHARS = /^(.)\1{3,}@/; // aaaa@, 1111@, etc.
// Catches consecutive keyboard rows: asdfghj, qwertyui, zxcvbnm, etc.
const KEYBOARD_ROWS = /^(qwertyuiop|asdfghjkl|zxcvbnm|qwerty|asdfgh|zxcvbn|qwert|asdfg|zxcvb)/i;

// ── MX record checker ──────────────────────────────────────────────────────
function checkMX(domain) {
  return new Promise((resolve) => {
    const resolver = new dns.Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1']); // use public DNS — reliable
    resolver.resolveMx(domain, (err, addresses) => {
      if (err) {
        // ENODATA = domain exists but no MX. ENOTFOUND = domain doesn't exist.
        resolve(false);
      } else {
        resolve(addresses && addresses.length > 0);
      }
    });
  });
}

// ── Main validator ─────────────────────────────────────────────────────────
async function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email is required.' };
  }

  const trimmed = email.trim().toLowerCase();

  // 1. Basic format check
  const formatRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!formatRe.test(trimmed)) {
    return { valid: false, reason: 'Please enter a valid email address.' };
  }

  const [localPart, domain] = trimmed.split('@');

  // 2. Blocklist check
  if (BLOCKED_DOMAINS.has(domain)) {
    return { valid: false, reason: 'Disposable or temporary email addresses are not accepted. Please use your work or personal email.' };
  }

  // 3. Suspicious local-part patterns
  if (KEYBOARD_PATTERNS.test(localPart) || KEYBOARD_ROWS.test(localPart)) {
    return { valid: false, reason: 'Please enter a real email address.' };
  }
  if (REPEATED_CHARS.test(trimmed)) {
    return { valid: false, reason: 'Please enter a real email address.' };
  }

  // 4. MX record check — does this domain actually receive email?
  const hasMX = await checkMX(domain);
  if (!hasMX) {
    return { valid: false, reason: `The domain "${domain}" doesn't appear to be a real email provider. Please check your email address.` };
  }

  return { valid: true, reason: null };
}

module.exports = { validateEmail };
