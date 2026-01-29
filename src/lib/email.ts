import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import prisma from './db';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface SmtpConfig {
  enabled: boolean;
  service: string;
  host: string | null;
  port: number;
  secure: boolean;
  ignoreTls: boolean;
  username: string | null;
  password: string | null;
  fromEmail: string | null;
  fromName: string;
}

/**
 * Get SMTP settings from database
 */
async function getSmtpSettings(): Promise<SmtpConfig | null> {
  const settings = await prisma.smtpSettings.findFirst();
  if (!settings || !settings.enabled) {
    return null;
  }
  return settings as SmtpConfig;
}

/**
 * Create a nodemailer transporter based on SMTP settings
 */
function createTransporter(config: SmtpConfig): Transporter {
  const transportOptions: nodemailer.TransportOptions = {
    host: config.host || undefined,
    port: config.port,
    secure: config.secure,
    ignoreTLS: config.ignoreTls,
  } as nodemailer.TransportOptions;

  // Add auth if credentials provided
  if (config.username) {
    (transportOptions as Record<string, unknown>).auth = {
      user: config.username,
      pass: config.password || undefined,
    };
  }

  return nodemailer.createTransport(transportOptions);
}

/**
 * Send an email using configured SMTP settings
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  const config = await getSmtpSettings();
  
  if (!config) {
    // Log to console when SMTP not configured (for development)
    console.log('='.repeat(60));
    console.log('EMAIL (SMTP not configured - logging to console)');
    console.log('='.repeat(60));
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log('-'.repeat(60));
    console.log(options.text);
    console.log('='.repeat(60));
    return { success: true };
  }

  try {
    const transporter = createTransporter(config);
    
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    };
  }
}

/**
 * Send OTP email to user
 */
export async function sendOtpEmail(email: string, otpCode: string, userName?: string): Promise<{ success: boolean; error?: string }> {
  const greeting = userName ? `Hello ${userName}` : 'Hello';
  
  const subject = 'Your SyncEngine Login Code';
  
  const text = `
${greeting},

Your login verification code is: ${otpCode}

This code will expire in 10 minutes.

If you did not request this code, please ignore this email.

- SyncEngine Team
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">SyncEngine</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">AI-Powered Web Scraping Platform</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">${greeting},</p>
      
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">Your login verification code is:</p>
      
      <!-- OTP Code -->
      <div style="background-color: #f9fafb; border: 2px dashed #d1d5db; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 24px;">
        <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #10b981;">${otpCode}</span>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">
        ⏱️ This code will expire in <strong>10 minutes</strong>.
      </p>
      
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        If you did not request this code, please ignore this email.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
        This is an automated message from SyncEngine.<br>
        Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
`;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}

/**
 * Send account approval notification email
 */
export async function sendApprovalEmail(email: string, userName?: string): Promise<{ success: boolean; error?: string }> {
  const greeting = userName ? `Hello ${userName}` : 'Hello';
  
  const subject = 'Your SyncEngine Account Has Been Approved';
  
  const text = `
${greeting},

Great news! Your SyncEngine account has been approved.

You can now log in using your email address. Each time you log in, you'll receive a verification code via email.

- SyncEngine Team
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">SyncEngine</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">AI-Powered Web Scraping Platform</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">${greeting},</p>
      
      <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 0 8px 8px 0; margin: 0 0 24px;">
        <p style="color: #065f46; font-size: 16px; font-weight: 600; margin: 0;">
          ✓ Your account has been approved!
        </p>
      </div>
      
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
        You can now log in to SyncEngine using your email address. Each time you log in, you'll receive a one-time verification code via email.
      </p>
      
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        Welcome to the team!
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
        This is an automated message from SyncEngine.<br>
        Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
`;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}

/**
 * Test SMTP connection with current settings
 */
export async function testSmtpConnection(config: Partial<SmtpConfig>): Promise<{ success: boolean; error?: string }> {
  try {
    const transportOptions: nodemailer.TransportOptions = {
      host: config.host || undefined,
      port: config.port || 25,
      secure: config.secure || false,
      ignoreTLS: config.ignoreTls || false,
    } as nodemailer.TransportOptions;

    if (config.username) {
      (transportOptions as Record<string, unknown>).auth = {
        user: config.username,
        pass: config.password || undefined,
      };
    }

    const transporter = nodemailer.createTransport(transportOptions);
    await transporter.verify();
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection failed' 
    };
  }
}

