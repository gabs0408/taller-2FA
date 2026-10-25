const CryptoJS = require('crypto-js');

// RFC 4648 Base32 alphabet
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32ToWordArray(base32) {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_CHARS.indexOf(clean.charAt(i));
    if (val === -1) {
      throw new Error(`Carácter Base32 inválido: ${clean.charAt(i)}`);
    }
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  // Convert byte array to CryptoJS WordArray
  const words = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

/**
 * Generates a 6-digit TOTP token according to RFC 6238
 * @param {string} secret Base32 encoded secret key
 * @param {number} timeStep Time interval in seconds (default 30)
 * @param {number} digits Token length (default 6)
 * @returns {string} 6-digit TOTP code
 */
function generateTOTP(secret = 'JBSWY3DPEHPK3PXP', timeStep = 30, digits = 6) {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep);

  // Convert counter to 8-byte big-endian WordArray
  const high = Math.floor(counter / 0x100000000);
  const low = counter & 0xffffffff;
  const counterWords = CryptoJS.lib.WordArray.create([high, low], 8);

  const keyWords = base32ToWordArray(secret);

  // HMAC-SHA1
  const hmac = CryptoJS.HmacSHA1(counterWords, keyWords);

  // Dynamic truncation
  // hmac.words has 5 words (20 bytes)
  const hmacBytes = [];
  for (let i = 0; i < 20; i++) {
    hmacBytes.push((hmac.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff);
  }

  const offset = hmacBytes[19] & 0x0f;
  const binaryCode =
    ((hmacBytes[offset] & 0x7f) << 24) |
    ((hmacBytes[offset + 1] & 0xff) << 16) |
    ((hmacBytes[offset + 2] & 0xff) << 8) |
    (hmacBytes[offset + 3] & 0xff);

  const otp = (binaryCode % Math.pow(10, digits)).toString();
  return otp.padStart(digits, '0');
}

/**
 * Returns remaining seconds in the current 30-second window
 * @param {number} timeStep
 * @returns {number}
 */
function getRemainingSeconds(timeStep = 30) {
  const epoch = Math.floor(Date.now() / 1000);
  return timeStep - (epoch % timeStep);
}

module.exports = {
  generateTOTP,
  getRemainingSeconds,
  base32ToWordArray,
};
