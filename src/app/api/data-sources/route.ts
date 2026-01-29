import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const dataSources = await prisma.dataSource.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { syncConfigs: true }
        }
      }
    });
    
    // Don't expose passwords in list view
    const sanitized = dataSources.map(({ password, ...rest }) => ({
      ...rest,
      password: '********'
    }));
    
    return NextResponse.json(sanitized);
  } catch (error) {
    console.error('Get data sources error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data sources' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { name, description, dbType, host, port, database, username, password, sslEnabled } = body;
    
    // SQLite only requires name and database (file path)
    if (dbType === 'sqlite') {
      if (!name || !database) {
        return NextResponse.json(
          { error: 'Missing required fields: name and database path are required for SQLite' },
          { status: 400 }
        );
      }
    } else {
      // Other databases require full connection details
      if (!name || !dbType || !host || !port || !database || !username || !password) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }
    }
    
    const dataSource = await prisma.dataSource.create({
      data: {
        name,
        description,
        dbType,
        host: dbType === 'sqlite' ? 'localhost' : host,
        port: dbType === 'sqlite' ? 0 : parseInt(port),
        database,
        username: dbType === 'sqlite' ? 'admin' : username,
        password: dbType === 'sqlite' ? 'sqlite' : password, // In production, encrypt this
        sslEnabled: dbType === 'sqlite' ? false : (sslEnabled ?? true),
      }
    });
    
    // Log the creation
    await prisma.auditLog.create({
      data: {
        eventType: 'data_source_created',
        eventDetails: JSON.stringify({ name, dbType, host }),
        resourceType: 'data_source',
        resourceId: dataSource.id,
        dataSourceId: dataSource.id
      }
    });
    
    return NextResponse.json({ ...dataSource, password: '********' }, { status: 201 });
  } catch (error) {
    console.error('Create data source error:', error);
    return NextResponse.json(
      { error: 'Failed to create data source' },
      { status: 500 }
    );
  }
}

