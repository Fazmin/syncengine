import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Generate a 6-digit OTP code
 */
export function generateOtpCode(): string {
  // Generate a cryptographically secure random 6-digit number
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0);
  const code = (num % 900000) + 100000; // Ensures 6 digits (100000-999999)
  return code.toString();
}

/**
 * Hash an OTP code for storage
 */
export async function hashOtpCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

/**
 * Verify an OTP code against its hash
 */
export async function verifyOtpCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/**
 * Get OTP expiry time (10 minutes from now)
 */
export function getOtpExpiryTime(): Date {
  return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
}

/**
 * Get session expiry time (120 minutes from now)
 */
export function getSessionExpiryTime(): Date {
  return new Date(Date.now() + 120 * 60 * 1000); // 120 minutes (2 hours)
}

/**
 * Check if an OTP has expired
 */
export function isOtpExpired(expiresAt: Date): boolean {
  return new Date() > new Date(expiresAt);
}

/**
 * Format remaining time for display
 */
export function formatRemainingTime(expiresAt: Date): string {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return 'Expired';
  
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

