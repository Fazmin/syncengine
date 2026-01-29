import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { testSmtpConnection } from '@/lib/email';
import { decrypt } from '@/lib/encryption';

// POST /api/smtp/test - Test SMTP connection
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admins can test SMTP
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      host,
      port,
      secure,
      ignoreTls,
      username,
      password,
      useExisting,
    } = body;

    let testConfig: {
      host: string | null;
      port: number;
      secure: boolean;
      ignoreTls: boolean;
      username: string | null;
      password: string | null;
    };

    if (useExisting) {
      // Test with saved settings
      const existing = await prisma.smtpSettings.findFirst();
      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'No SMTP settings configured' },
          { status: 400 }
        );
      }

      testConfig = {
        host: existing.host,
        port: existing.port,
        secure: existing.secure,
        ignoreTls: existing.ignoreTls,
        username: existing.username,
        password: existing.password ? decrypt(existing.password) : null,
      };
    } else {
      // Test with provided settings
      testConfig = {
        host: host || null,
        port: port || 25,
        secure: secure ?? false,
        ignoreTls: ignoreTls ?? false,
        username: username || null,
        password: password && password !== '********' ? password : null,
      };

      // If password is masked, try to get from existing
      if (password === '********') {
        const existing = await prisma.smtpSettings.findFirst();
        if (existing?.password) {
          testConfig.password = decrypt(existing.password);
        }
      }
    }

    const result = await testSmtpConnection(testConfig);

    // Update test status in database if testing existing config
    if (useExisting) {
      const existing = await prisma.smtpSettings.findFirst();
      if (existing) {
        await prisma.smtpSettings.update({
          where: { id: existing.id },
          data: {
            lastTestedAt: new Date(),
            testStatus: result.success ? 'success' : 'failed',
            testError: result.error || null,
          },
        });
      }
    }

    // Log test
    await prisma.auditLog.create({
      data: {
        eventType: 'smtp_tested',
        eventDetails: JSON.stringify({
          success: result.success,
          error: result.error,
          host: testConfig.host,
        }),
        userId: session.user.id,
        userEmail: session.user.email,
        resourceType: 'smtp_settings',
      },
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'SMTP connection successful',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Connection failed',
      });
    }
  } catch (error) {
    console.error('Error testing SMTP:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test SMTP connection' },
      { status: 500 }
    );
  }
}

