const crypto = require('node:crypto');

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = String(value || '').toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  if (!normalized || /[^A-Z2-7]/.test(normalized)) throw new Error('Secreto TOTP no valido.');
  let bits = '';
  for (const character of normalized) bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

function generateTotp(secret, timestamp = Date.now(), stepSeconds = 30) {
  const counter = Math.floor(timestamp / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(binary).padStart(6, '0');
}

function verifyTotp(code, secret, timestamp = Date.now()) {
  const supplied = Buffer.from(String(code || ''));
  if (!/^\d{6}$/.test(supplied.toString())) return false;
  for (const drift of [-30_000, 0, 30_000]) {
    const expected = Buffer.from(generateTotp(secret, timestamp + drift));
    if (expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied)) return true;
  }
  return false;
}

module.exports = { decodeBase32, generateTotp, verifyTotp };
