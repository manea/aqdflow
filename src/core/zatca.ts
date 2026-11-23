export interface ZatcaQrInput {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  invoiceTotal: number | string;
  vatTotal: number | string;
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Strip non-digit noise only when checking formatted TRN? No — strict 15-digit check
 * after trimming outer whitespace so invalid characters fail cleanly.
 */
export function normalizeDigits(value: string | undefined | null): string {
  return (value ?? '').replace(/\s+/g, '');
}

/**
 * KSA ZATCA VAT Registration Number: exactly 15 digits, starting and ending with '3'.
 */
export function isValidKsaVatNumber(trn: string | undefined | null): boolean {
  const clean = normalizeDigits(trn);
  return /^3\d{13}3$/.test(clean);
}

/**
 * UAE FTA Tax Registration Number (TRN): exactly 15 digits.
 */
export function isValidUaeTrn(trn: string | undefined | null): boolean {
  const clean = normalizeDigits(trn);
  return /^\d{15}$/.test(clean);
}

function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const hasB1 = i + 1 < bytes.length;
    const hasB2 = i + 2 < bytes.length;

    out += BASE64_ALPHABET[b0 >> 2];
    out += BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += hasB1 ? BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    out += hasB2 ? BASE64_ALPHABET[b2 & 0x3f] : '=';
  }
  return out;
}

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.trim();
  if (clean.length === 0 || clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
    throw new Error('Invalid Base64 input for ZATCA TLV payload');
  }

  let padding = 0;
  if (clean.endsWith('==')) padding = 2;
  else if (clean.endsWith('=')) padding = 1;

  const byteLength = (clean.length / 4) * 3 - padding;
  const out = new Uint8Array(byteLength);

  let outIdx = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_ALPHABET.indexOf(clean[i] ?? '');
    const c1 = BASE64_ALPHABET.indexOf(clean[i + 1] ?? '');
    const ch2 = clean[i + 2] ?? '=';
    const ch3 = clean[i + 3] ?? '=';
    const c2 = ch2 === '=' ? 0 : BASE64_ALPHABET.indexOf(ch2);
    const c3 = ch3 === '=' ? 0 : BASE64_ALPHABET.indexOf(ch3);

    if (c0 < 0 || c1 < 0 || (ch2 !== '=' && c2 < 0) || (ch3 !== '=' && c3 < 0)) {
      throw new Error('Malformed Base64 characters in ZATCA TLV payload');
    }

    const combined = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (outIdx < byteLength) out[outIdx++] = (combined >> 16) & 0xff;
    if (outIdx < byteLength) out[outIdx++] = (combined >> 8) & 0xff;
    if (outIdx < byteLength) out[outIdx++] = combined & 0xff;
  }
  return out;
}

function formatZatcaDecimal(value: number | string, fieldName: string): string {
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Invalid monetary value for ZATCA ${fieldName}`);
  }
  return num.toFixed(2);
}

function createTlvBlock(tag: number, value: string, label: string): Uint8Array {
  const valueBytes = utf8Encoder.encode(value);
  if (valueBytes.length === 0) {
    throw new Error(`ZATCA TLV tag ${tag} (${label}) must not be empty`);
  }
  if (valueBytes.length > 255) {
    throw new Error(
      `ZATCA TLV tag ${tag} (${label}) exceeds 255 UTF-8 bytes (${valueBytes.length} bytes)`,
    );
  }
  const block = new Uint8Array(2 + valueBytes.length);
  block[0] = tag;
  block[1] = valueBytes.length;
  block.set(valueBytes, 2);
  return block;
}

/**
 * Encodes the 5 mandatory KSA ZATCA Phase 1 tags in UTF-8 TLV bytes -> Base64.
 */
export function encodeZatcaTlvBase64(input: ZatcaQrInput): string {
  const sellerName = input.sellerName.trim();
  const vatNumber = normalizeDigits(input.vatNumber);
  const timestamp = input.timestamp.trim();

  if (!isValidKsaVatNumber(vatNumber)) {
    throw new Error('Invalid KSA VAT number: must be 15 digits starting and ending with 3');
  }
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
    throw new Error('Invalid ZATCA ISO-8601 timestamp');
  }

  const invoiceTotal = formatZatcaDecimal(input.invoiceTotal, 'invoiceTotal');
  const vatTotal = formatZatcaDecimal(input.vatTotal, 'vatTotal');

  const blocks = [
    createTlvBlock(1, sellerName, 'sellerName'),
    createTlvBlock(2, vatNumber, 'vatNumber'),
    createTlvBlock(3, timestamp, 'timestamp'),
    createTlvBlock(4, invoiceTotal, 'invoiceTotal'),
    createTlvBlock(5, vatTotal, 'vatTotal'),
  ];

  const totalLength = blocks.reduce((sum, b) => sum + b.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const block of blocks) {
    combined.set(block, offset);
    offset += block.length;
  }

  return bytesToBase64(combined);
}

/**
 * Decodes a Base64 ZATCA TLV byte stream and strictly validates TLV boundaries.
 */
export function decodeZatcaTlvBase64(base64: string): Record<number, string> {
  const bytes = base64ToBytes(base64);
  const result: Record<number, string> = {};
  let offset = 0;

  while (offset < bytes.length) {
    if (offset + 2 > bytes.length) {
      throw new Error('Truncated ZATCA TLV header');
    }
    const tag = bytes[offset] ?? 0;
    const len = bytes[offset + 1] ?? 0;
    offset += 2;

    if (tag <= 0) {
      throw new Error(`Invalid ZATCA TLV tag: ${tag}`);
    }
    if (len === 0) {
      throw new Error(`Empty value length in ZATCA TLV tag ${tag}`);
    }
    if (offset + len > bytes.length) {
      throw new Error(`Truncated ZATCA TLV value for tag ${tag}`);
    }

    const slice = bytes.subarray(offset, offset + len);
    result[tag] = utf8Decoder.decode(slice);
    offset += len;
  }

  return result;
}
