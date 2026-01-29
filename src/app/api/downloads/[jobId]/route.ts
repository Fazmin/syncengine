import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createReadStream, statSync, existsSync } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Get job details
    const job = await prisma.syncJob.findUnique({
      where: { id: jobId },
      include: {
        syncConfig: {
          select: { name: true, dataSourceId: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.status !== 'completed') {
      return NextResponse.json(
        { error: 'Job has not completed successfully' },
        { status: 400 }
      );
    }

    if (!job.outputFilePath) {
      return NextResponse.json(
        { error: 'Output file not available' },
        { status: 404 }
      );
    }

    const filePath = path.resolve(job.outputFilePath);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Output file not found on disk' },
        { status: 404 }
      );
    }

    // Log download
    await prisma.auditLog.create({
      data: {
        eventType: 'download',
        eventDetails: JSON.stringify({
          jobId,
          filePath: job.outputFilePath,
          fileSize: job.outputFileSize,
        }),
        resourceType: 'sync_job',
        resourceId: jobId,
        dataSourceId: job.syncConfig?.dataSourceId,
      },
    });

    // Get file stats
    const stats = statSync(filePath);
    const fileName = path.basename(filePath);

    // Determine content type
    let contentType = 'application/x-sqlite3';
    if (fileName.endsWith('.gz')) {
      contentType = 'application/gzip';
    } else if (fileName.endsWith('.enc')) {
      contentType = 'application/octet-stream';
    }

    // Create readable stream
    const stream = createReadStream(filePath);

    // Convert Node.js stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        stream.on('end', () => {
          controller.close();
        });
        stream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        stream.destroy();
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}

