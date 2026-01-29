import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { encrypt } from '@/lib/encryption';

export async function GET() {
  try {
    const webSources = await prisma.webSource.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { assignments: true }
        }
      }
    });
    
    // Don't expose auth config in list view
    const sanitized = webSources.map(({ authConfig, ...rest }) => ({
      ...rest,
      authConfig: authConfig ? '********' : null
    }));
    
    return NextResponse.json(sanitized);
  } catch (error) {
    console.error('Get web sources error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch web sources' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { 
      name, 
      baseUrl, 
      description, 
      scraperType, 
      authType, 
      authConfig,
      requestDelay,
      maxConcurrent 
    } = body;
    
    if (!name || !baseUrl) {
      return NextResponse.json(
        { error: 'Name and base URL are required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(baseUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }
    
    // Encrypt auth config if provided
    let encryptedAuthConfig = null;
    if (authConfig) {
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
    
    const webSource = await prisma.webSource.create({
      data: {
        name,
        baseUrl,
        description,
        scraperType: scraperType || 'hybrid',
        authType: authType || 'none',
        authConfig: encryptedAuthConfig,
        requestDelay: requestDelay || 1000,
        maxConcurrent: maxConcurrent || 1,
      }
    });
    
    // Log the creation
    await prisma.auditLog.create({
      data: {
        eventType: 'web_source_created',
        eventDetails: JSON.stringify({ name, baseUrl }),
        resourceType: 'web_source',
        resourceId: webSource.id,
      }
    });
    
    return NextResponse.json({ ...webSource, authConfig: authConfig ? '********' : null }, { status: 201 });
  } catch (error) {
    console.error('Create web source error:', error);
    return NextResponse.json(
      { error: 'Failed to create web source' },
      { status: 500 }
    );
  }
}
