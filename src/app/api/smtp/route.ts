import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/encryption';

// GET /api/smtp - Get SMTP settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admins can view SMTP settings
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    let settings = await prisma.smtpSettings.findFirst();

    if (!settings) {
      // Return default settings if none exist
      return NextResponse.json({
        success: true,
        data: {
          enabled: false,
          service: 'custom',
          host: '',
          port: 25,
          secure: false,
          ignoreTls: false,
          username: '',
          password: '',
          fromEmail: '',
          fromName: 'SyncEngine',
          lastTestedAt: null,
          testStatus: null,
          testError: null,
        },
      });
    }

    // Don't return the actual password, just indicate if it's set
    const data = {
      ...settings,
      password: settings.password ? '********' : '',
      hasPassword: !!settings.password,
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching SMTP settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SMTP settings' },
      { status: 500 }
    );
  }
}

// PUT /api/smtp - Update SMTP settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admins can update SMTP settings
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      enabled,
      service,
      host,
      port,
      secure,
      ignoreTls,
      username,
      password,
      fromEmail,
      fromName,
    } = body;

    // Get existing settings
    const existing = await prisma.smtpSettings.findFirst();

    // Prepare data
    const data: Record<string, unknown> = {
      enabled: enabled ?? false,
      service: service || 'custom',
      host: host || null,
      port: port || 25,
      secure: secure ?? false,
      ignoreTls: ignoreTls ?? false,
      username: username || null,
      fromEmail: fromEmail || null,
      fromName: fromName || 'SyncEngine',
    };

    // Only update password if a new one is provided (not the masked value)
    if (password && password !== '********') {
      data.password = encrypt(password);
    } else if (existing) {
      // Keep existing password
      data.password = existing.password;
    }

    let settings;
    if (existing) {
      settings = await prisma.smtpSettings.update({
        where: { id: existing.id },
        data,
      });
    } else {
      settings = await prisma.smtpSettings.create({
        data: data as {
          enabled: boolean;
          service: string;
          host: string | null;
          port: number;
          secure: boolean;
          ignoreTls: boolean;
          username: string | null;
          password?: string;
          fromEmail: string | null;
          fromName: string;
        },
      });
    }

    // Log SMTP config change
    await prisma.auditLog.create({
      data: {
        eventType: 'smtp_configured',
        eventDetails: JSON.stringify({
          enabled: settings.enabled,
          host: settings.host,
          port: settings.port,
        }),
        userId: session.user.id,
        userEmail: session.user.email,
        resourceType: 'smtp_settings',
        resourceId: settings.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...settings,
        password: settings.password ? '********' : '',
        hasPassword: !!settings.password,
      },
    });
  } catch (error) {
    console.error('Error updating SMTP settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update SMTP settings' },
      { status: 500 }
    );
  }
}

