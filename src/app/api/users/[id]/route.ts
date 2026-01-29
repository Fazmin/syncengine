import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { sendApprovalEmail } from '@/lib/email';

// GET /api/users/:id - Get user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admins can view user details
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
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

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get approver info if exists
    let approver = null;
    if (user.approvedBy) {
      approver = await prisma.user.findUnique({
        where: { id: user.approvedBy },
        select: { id: true, name: true, email: true },
      });
    }

    // Get recent activity for this user
    const recentActivity = await prisma.auditLog.findMany({
      where: {
        OR: [
          { userId: id },
          { resourceType: 'user', resourceId: id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        approver,
        recentActivity,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PUT /api/users/:id - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admins can update users
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, role, expiresAt, status, isActive } = body;

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent self-demotion
    if (id === session.user.id && role && role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // Track changes for audit log
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    const updateData: Record<string, unknown> = {};

    if (name !== undefined && name !== existingUser.name) {
      changes.name = { from: existingUser.name, to: name };
      updateData.name = name;
    }

    if (role !== undefined && role !== existingUser.role) {
      if (!['admin', 'supervisor'].includes(role)) {
        return NextResponse.json(
          { success: false, error: 'Invalid role' },
          { status: 400 }
        );
      }
      changes.role = { from: existingUser.role, to: role };
      updateData.role = role;
    }

    if (expiresAt !== undefined) {
      const newExpiry = expiresAt ? new Date(expiresAt) : null;
      const existingExpiry = existingUser.expiresAt ? new Date(existingUser.expiresAt).toISOString() : null;
      const newExpiryStr = newExpiry ? newExpiry.toISOString() : null;
      
      if (existingExpiry !== newExpiryStr) {
        changes.expiresAt = { from: existingExpiry, to: newExpiryStr };
        updateData.expiresAt = newExpiry;
      }
    }

    if (status !== undefined && status !== existingUser.status) {
      if (!['pending', 'approved', 'suspended', 'expired'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid status' },
          { status: 400 }
        );
      }
      changes.status = { from: existingUser.status, to: status };
      updateData.status = status;

      // If approving, set approval info
      if (status === 'approved' && existingUser.status !== 'approved') {
        updateData.approvedAt = new Date();
        updateData.approvedBy = session.user.id;
      }
    }

    if (isActive !== undefined && isActive !== existingUser.isActive) {
      changes.isActive = { from: existingUser.isActive, to: isActive };
      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        data: existingUser,
        message: 'No changes made',
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Send approval email if just approved
    if (status === 'approved' && existingUser.status !== 'approved') {
      await sendApprovalEmail(user.email, user.name || undefined);
    }

    // Log update
    await prisma.auditLog.create({
      data: {
        eventType: 'user_updated',
        eventDetails: JSON.stringify({ userId: id, changes }),
        userId: session.user.id,
        userEmail: session.user.email,
        resourceType: 'user',
        resourceId: id,
      },
    });

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/:id - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admins can delete users
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete user (OTP tokens will cascade delete)
    await prisma.user.delete({
      where: { id },
    });

    // Log deletion
    await prisma.auditLog.create({
      data: {
        eventType: 'user_deleted',
        eventDetails: JSON.stringify({ userId: id, email: user.email }),
        userId: session.user.id,
        userEmail: session.user.email,
        resourceType: 'user',
        resourceId: id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

