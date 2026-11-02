"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBase32Secret = generateBase32Secret;
exports.base32Decode = base32Decode;
exports.generateTotp = generateTotp;
exports.verifyTotp = verifyTotp;
exports.generateRecoveryCodes = generateRecoveryCodes;
const crypto_1 = __importDefault(require("crypto"));
// Standard RFC 4648 Base32 alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function generateBase32Secret(length = 20) {
    const bytes = crypto_1.default.randomBytes(length);
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
        result += BASE32_ALPHABET[bytes[i] % 32];
    }
    return result;
}
function base32Decode(base32Str) {
    const cleanStr = base32Str.toUpperCase().replace(/=+$/, '');
    let bits = '';
    for (let i = 0; i < cleanStr.length; i++) {
        const val = BASE32_ALPHABET.indexOf(cleanStr[i]);
        if (val === -1)
            continue;
        bits += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return Buffer.from(bytes);
}
function generateTotp(secretBase32, timeStepWindow = 0) {
    const key = base32Decode(secretBase32);
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30) + timeStepWindow;
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigInt64BE(BigInt(counter));
    const hmac = crypto_1.default.createHmac('sha1', key).update(counterBuf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
}
function verifyTotp(secretBase32, token) {
    const cleanToken = token.trim();
    if (cleanToken.length !== 6)
        return false;
    // Allow current step, 1 step back, and 1 step forward (tolerance for clock drift)
    for (let window = -1; window <= 1; window++) {
        if (generateTotp(secretBase32, window) === cleanToken) {
            return true;
        }
    }
    return false;
}
function generateRecoveryCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        const part1 = crypto_1.default.randomBytes(3).toString('hex').toUpperCase();
        const part2 = crypto_1.default.randomBytes(3).toString('hex').toUpperCase();
        codes.push(`${part1}-${part2}`);
    }
    return codes;
}
