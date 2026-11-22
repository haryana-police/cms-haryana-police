import crypto from 'crypto';

/**
 * Password helpers built on Node's built-in scrypt KDF.
 *
 * Stored format: scrypt$<saltHex>$<hashHex>
 * Legacy rows may contain a plaintext password; verifyPassword accepts those
 * so existing accounts keep working until they are re-hashed on next login.
 */

const PREFIX = 'scrypt$';
const SALT_BYTES = 16;
const KEY_BYTES = 64;

export function hashPassword(plain) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = crypto.scryptSync(String(plain), salt, KEY_BYTES);
  return `${PREFIX}${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Constant-time comparison of two strings via fixed-length SHA-256 digests. */
function constantTimeStringEqual(a, b) {
  const digestA = crypto.createHash('sha256').update(String(a)).digest();
  const digestB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export function verifyPassword(plain, stored) {
  if (plain === undefined || plain === null || stored === undefined || stored === null) return false;

  if (typeof stored === 'string' && stored.startsWith(PREFIX)) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    if (!salt.length || !expected.length) return false;
    try {
      const actual = crypto.scryptSync(String(plain), salt, expected.length);
      return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    } catch (err) {
      console.error('Password verification error:', err.message);
      return false;
    }
  }

  // Legacy plaintext row — compare without early exit so timing is not
  // directly proportional to the length of the shared prefix.
  return constantTimeStringEqual(plain, stored);
}

export function needsRehash(stored) {
  if (typeof stored !== 'string' || !stored.startsWith(PREFIX)) return true;
  const parts = stored.split('$');
  return parts.length !== 3 || !/^[0-9a-f]+$/i.test(parts[1]) || !/^[0-9a-f]+$/i.test(parts[2]);
}
