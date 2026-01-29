import crypto from 'crypto';

export type MaskingType = 'none' | 'redact' | 'hash' | 'randomize' | 'partial';

export interface MaskingConfig {
  visibleChars?: number;      // For partial masking
  visibleStart?: number;      // Chars visible at start
  visibleEnd?: number;        // Chars visible at end
  maskChar?: string;          // Character to use for masking
  preserveLength?: boolean;   // Keep original length when randomizing
  hashAlgorithm?: string;     // For hash masking
}

const DEFAULT_CONFIG: MaskingConfig = {
  visibleChars: 4,
  visibleStart: 2,
  visibleEnd: 2,
  maskChar: '*',
  preserveLength: true,
  hashAlgorithm: 'sha256',
};

/**
 * Apply masking to a value based on the masking type
 */
export function maskValue(
  value: unknown,
  type: MaskingType,
  config?: MaskingConfig
): unknown {
  if (value === null || value === undefined) return value;
  if (type === 'none') return value;

  const cfg = { ...DEFAULT_CONFIG, ...config };
  const strValue = String(value);

  switch (type) {
    case 'redact':
      return redactValue(strValue, cfg);
    case 'hash':
      return hashValue(strValue, cfg);
    case 'randomize':
      return randomizeValue(value, cfg);
    case 'partial':
      return partialMask(strValue, cfg);
    default:
      return value;
  }
}

/**
 * Completely redact the value
 */
function redactValue(value: string, config: MaskingConfig): string {
  if (config.preserveLength) {
    return config.maskChar!.repeat(value.length);
  }
  return '[REDACTED]';
}

/**
 * Hash the value using specified algorithm
 */
function hashValue(value: string, config: MaskingConfig): string {
  return crypto
    .createHash(config.hashAlgorithm || 'sha256')
    .update(value)
    .digest('hex');
}

/**
 * Replace value with random data of same type
 */
function randomizeValue(value: unknown, config: MaskingConfig): unknown {
  const type = typeof value;

  switch (type) {
    case 'number':
      return randomNumber(value as number, config);
    case 'string':
      return randomString(value as string, config);
    case 'boolean':
      return Math.random() > 0.5;
    default:
      return value;
  }
}

/**
 * Generate random number similar to original
 */
function randomNumber(original: number, config: MaskingConfig): number {
  const isInteger = Number.isInteger(original);
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(original) || 1)));
  const random = Math.random() * magnitude * 10;
  
  return isInteger ? Math.floor(random) : parseFloat(random.toFixed(2));
}

/**
 * Generate random string similar to original
 */
function randomString(original: string, config: MaskingConfig): string {
  const length = config.preserveLength ? original.length : original.length;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
  let result = '';
  for (let i = 0; i < length; i++) {
    // Preserve character type (letter, number, special)
    const char = original[i];
    if (/[A-Z]/.test(char)) {
      result += chars.charAt(Math.floor(Math.random() * 26));
    } else if (/[a-z]/.test(char)) {
      result += chars.charAt(26 + Math.floor(Math.random() * 26));
    } else if (/[0-9]/.test(char)) {
      result += chars.charAt(52 + Math.floor(Math.random() * 10));
    } else {
      result += char; // Preserve special characters
    }
  }
  
  return result;
}

/**
 * Partially mask a value, showing only some characters
 */
function partialMask(value: string, config: MaskingConfig): string {
  const visibleStart = config.visibleStart ?? config.visibleChars ?? 2;
  const visibleEnd = config.visibleEnd ?? config.visibleChars ?? 2;
  const maskChar = config.maskChar || '*';

  if (value.length <= visibleStart + visibleEnd) {
    // Value too short, mask middle character(s)
    const midPoint = Math.floor(value.length / 2);
    return value.slice(0, midPoint) + maskChar + value.slice(midPoint + 1);
  }

  const start = value.slice(0, visibleStart);
  const end = value.slice(-visibleEnd);
  const maskedLength = value.length - visibleStart - visibleEnd;
  const masked = maskChar.repeat(Math.min(maskedLength, 8)); // Cap mask length

  return `${start}${masked}${end}`;
}

/**
 * Mask email addresses
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return maskValue(email, 'partial') as string;
  
  const maskedLocal = partialMask(local, { visibleStart: 1, visibleEnd: 1 });
  const domainParts = domain.split('.');
  const maskedDomain = domainParts.length > 1 
    ? `${partialMask(domainParts[0], { visibleStart: 1, visibleEnd: 0 })}.${domainParts.slice(1).join('.')}`
    : domain;
  
  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Mask phone numbers
 */
export function maskPhone(phone: string): string {
  // Remove non-digits for processing
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  
  // Show last 4 digits
  return `***-***-${digits.slice(-4)}`;
}

/**
 * Mask SSN/Tax IDs
 */
export function maskSSN(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  
  return `***-**-${digits.slice(-4)}`;
}

/**
 * Mask credit card numbers
 */
export function maskCreditCard(card: string): string {
  const digits = card.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  
  return `****-****-****-${digits.slice(-4)}`;
}

/**
 * Apply appropriate masking based on column name patterns
 */
export function autoDetectMasking(columnName: string, value: unknown): unknown {
  const lowerName = columnName.toLowerCase();
  const strValue = String(value);
  
  if (lowerName.includes('password') || lowerName.includes('secret') || lowerName.includes('token')) {
    return maskValue(strValue, 'redact');
  }
  
  if (lowerName.includes('email')) {
    return maskEmail(strValue);
  }
  
  if (lowerName.includes('phone') || lowerName.includes('mobile') || lowerName.includes('tel')) {
    return maskPhone(strValue);
  }
  
  if (lowerName.includes('ssn') || lowerName.includes('social_security') || lowerName.includes('tax_id')) {
    return maskSSN(strValue);
  }
  
  if (lowerName.includes('card') || lowerName.includes('credit') || lowerName.includes('account')) {
    if (/^\d{13,19}$/.test(strValue.replace(/\D/g, ''))) {
      return maskCreditCard(strValue);
    }
  }
  
  return value;
}

