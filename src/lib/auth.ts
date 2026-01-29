import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from './db';
import { verifyOtpCode, isOtpExpired } from './otp';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'otp',
      credentials: {
        email: { label: 'Email', type: 'email' },
        otp: { label: 'OTP', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.otp) {
          throw new Error('Email and OTP required');
        }

        // Find the user
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error('User not found');
        }

        // Check user status
        if (user.status === 'pending') {
          throw new Error('Account pending approval');
        }

        if (user.status === 'suspended') {
          throw new Error('Account suspended');
        }

        if (user.status === 'expired' || (user.expiresAt && new Date(user.expiresAt) < new Date())) {
          // Update status if expired
          if (user.status !== 'expired') {
            await prisma.user.update({
              where: { id: user.id },
              data: { status: 'expired' },
            });
          }
          throw new Error('Account expired');
        }

        if (!user.isActive) {
          throw new Error('Account inactive');
        }

        // Find valid OTP token
        const otpToken = await prisma.otpToken.findFirst({
          where: {
            userId: user.id,
            used: false,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!otpToken) {
          throw new Error('No valid OTP found. Please request a new code.');
        }

        // Verify the OTP
        const isValidOtp = await verifyOtpCode(credentials.otp, otpToken.code);

        if (!isValidOtp) {
          // Log failed attempt
          await prisma.auditLog.create({
            data: {
              eventType: 'otp_failed',
              eventDetails: JSON.stringify({ email: user.email, reason: 'Invalid OTP' }),
              userId: user.id,
              userEmail: user.email,
            },
          });
          throw new Error('Invalid OTP');
        }

        // Check if OTP expired (double check)
        if (isOtpExpired(otpToken.expiresAt)) {
          throw new Error('OTP has expired. Please request a new code.');
        }

        // Mark OTP as used
        await prisma.otpToken.update({
          where: { id: otpToken.id },
          data: { used: true, usedAt: new Date() },
        });

        // Update user login info
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            lastLoginAt: new Date(),
            loginCount: { increment: 1 },
          },
        });

        // Log successful login
        await prisma.auditLog.create({
          data: {
            eventType: 'login_success',
            eventDetails: JSON.stringify({ email: user.email }),
            userId: user.id,
            userEmail: user.email,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 120 * 60, // 120 minutes (2 hours)
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
};

/**
 * Check if user can request OTP (user exists, approved, active, not expired)
 */
export async function canUserLogin(email: string): Promise<{ 
  canLogin: boolean; 
  error?: string; 
  user?: { id: string; name: string | null; email: string; status: string } 
}> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, status: true, isActive: true, expiresAt: true },
  });

  if (!user) {
    return { canLogin: false, error: 'No account found with this email address' };
  }

  if (user.status === 'pending') {
    return { canLogin: false, error: 'Your account is pending approval. Please wait for an administrator to approve your account.' };
  }

  if (user.status === 'suspended') {
    return { canLogin: false, error: 'Your account has been suspended. Please contact an administrator.' };
  }

  if (!user.isActive) {
    return { canLogin: false, error: 'Your account is inactive. Please contact an administrator.' };
  }

  // Check expiry
  if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
    // Update status to expired
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'expired' },
    });
    return { canLogin: false, error: 'Your account has expired. Please contact an administrator.' };
  }

  if (user.status === 'expired') {
    return { canLogin: false, error: 'Your account has expired. Please contact an administrator.' };
  }

  return { canLogin: true, user };
}
