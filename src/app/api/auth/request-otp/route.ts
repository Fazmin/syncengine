import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { canUserLogin } from '@/lib/auth';
import { generateOtpCode, hashOtpCode, getOtpExpiryTime } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user can login
    const { canLogin, error, user } = await canUserLogin(email);

    if (!canLogin || !user) {
      // Log failed attempt
      await prisma.auditLog.create({
        data: {
          eventType: 'otp_request_failed',
          eventDetails: JSON.stringify({ email, reason: error }),
          userEmail: email,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        },
      });

      return NextResponse.json(
        { success: false, error },
        { status: 400 }
      );
    }

    // Invalidate any existing unused OTP tokens for this user
    await prisma.otpToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: {
        used: true,
      },
    });

    // Generate new OTP
    const otpCode = generateOtpCode();
    const hashedCode = await hashOtpCode(otpCode);
    const expiresAt = getOtpExpiryTime();

    // Store OTP token
    await prisma.otpToken.create({
      data: {
        code: hashedCode,
        userId: user.id,
        expiresAt,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    // Send OTP email
    const emailResult = await sendOtpEmail(email, otpCode, user.name || undefined);

    if (!emailResult.success) {
      // Log email failure
      await prisma.auditLog.create({
        data: {
          eventType: 'otp_email_failed',
          eventDetails: JSON.stringify({ email, error: emailResult.error }),
          userId: user.id,
          userEmail: email,
        },
      });

      return NextResponse.json(
        { success: false, error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      );
    }

    // Log successful OTP request
    await prisma.auditLog.create({
      data: {
        eventType: 'otp_requested',
        eventDetails: JSON.stringify({ email }),
        userId: user.id,
        userEmail: email,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Error requesting OTP:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

