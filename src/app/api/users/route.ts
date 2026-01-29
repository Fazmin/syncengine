import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';

// GET /api/users - List all users
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admins can view users
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (role && role !== 'all') {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        isActive: true,
        expiresAt: true,
        approvedAt: true,
        approvedBy: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Get stats
    const stats = await prisma.user.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { status: 'approved', isActive: true } });

    return NextResponse.json({
      success: true,
      data: users,
      stats: {
        total: totalUsers,
        active: activeUsers,
        byStatus: stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admins can create users
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, name, role, expiresAt, autoApprove } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    // Validate role
    if (role && !['admin', 'supervisor'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role. Must be admin or supervisor' },
        { status: 400 }
      );
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        role: role || 'supervisor',
        status: autoApprove ? 'approved' : 'pending',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        approvedAt: autoApprove ? new Date() : null,
        approvedBy: autoApprove ? session.user.id : null,
      },
    });

    // Log user creation
    await prisma.auditLog.create({
      data: {
        eventType: 'user_created',
        eventDetails: JSON.stringify({
          userId: user.id,
          email: user.email,
          role: user.role,
          autoApproved: autoApprove,
        }),
        userId: session.user.id,
        userEmail: session.user.email,
        resourceType: 'user',
        resourceId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

