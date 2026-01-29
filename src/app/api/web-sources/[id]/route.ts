import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const webSource = await prisma.webSource.findUnique({
      where: { id },
      include: {
        assignments: {
          select: {
            id: true,
            name: true,
            status: true,
            syncMode: true,
          }
        },
        _count: {
          select: { assignments: true }
        }
      }
    });
    
    if (!webSource) {
      return NextResponse.json(
        { error: 'Web source not found' },
        { status: 404 }
      );
    }
    
    // Don't expose auth config
    const { authConfig, ...rest } = webSource;
    
    return NextResponse.json({
      ...rest,
      authConfig: authConfig ? '********' : null,
      hasAuthConfig: !!authConfig
    });
  } catch (error) {
    console.error('Get web source error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch web source' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const existing = await prisma.webSource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Web source not found' },
        { status: 404 }
      );
    }
    
    const {
      name,
      baseUrl,
      description,
      scraperType,
      authType,
      authConfig,
      requestDelay,
      maxConcurrent,
      paginationType,
      paginationConfig,
      isActive
    } = body;

    // Validate URL if provided
    if (baseUrl) {
      try {
        new URL(baseUrl);
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
    }

    // Encrypt auth config if provided and not already encrypted
    let encryptedAuthConfig = undefined;
    if (authConfig !== undefined) {
      if (authConfig === null || authConfig === '') {
        encryptedAuthConfig = null;
      } else if (authConfig !== '********') {
        try {
          const configStr = typeof authConfig === 'string' 
            ? authConfig 
            : JSON.stringify(authConfig);
          encryptedAuthConfig = encrypt(configStr);
        } catch {
          return NextResponse.json(
            { error: 'Invalid auth config format' },
            { status: 400 }
          );
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
    if (description !== undefined) updateData.description = description;
    if (scraperType !== undefined) updateData.scraperType = scraperType;
    if (authType !== undefined) updateData.authType = authType;
    if (encryptedAuthConfig !== undefined) updateData.authConfig = encryptedAuthConfig;
    if (requestDelay !== undefined) updateData.requestDelay = requestDelay;
    if (maxConcurrent !== undefined) updateData.maxConcurrent = maxConcurrent;
    if (paginationType !== undefined) updateData.paginationType = paginationType;
    if (paginationConfig !== undefined) {
      updateData.paginationConfig = typeof paginationConfig === 'string'
        ? paginationConfig
        : JSON.stringify(paginationConfig);
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const webSource = await prisma.webSource.update({
      where: { id },
      data: updateData
    });
    
    // Log the update
    await prisma.auditLog.create({
      data: {
        eventType: 'web_source_updated',
        eventDetails: JSON.stringify({ id, changes: Object.keys(updateData) }),
        resourceType: 'web_source',
        resourceId: id,
      }
    });
    
    return NextResponse.json({ ...webSource, authConfig: webSource.authConfig ? '********' : null });
  } catch (error) {
    console.error('Update web source error:', error);
    return NextResponse.json(
      { error: 'Failed to update web source' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const existing = await prisma.webSource.findUnique({
      where: { id },
      include: {
        _count: { select: { assignments: true } }
      }
    });
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Web source not found' },
        { status: 404 }
      );
    }
    
    if (existing._count.assignments > 0) {
      return NextResponse.json(
        { error: 'Cannot delete web source with active assignments' },
        { status: 400 }
      );
    }
    
    await prisma.webSource.delete({ where: { id } });
    
    // Log the deletion
    await prisma.auditLog.create({
      data: {
        eventType: 'web_source_deleted',
        eventDetails: JSON.stringify({ id, name: existing.name }),
        resourceType: 'web_source',
        resourceId: id,
      }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete web source error:', error);
    return NextResponse.json(
      { error: 'Failed to delete web source' },
      { status: 500 }
    );
  }
}
