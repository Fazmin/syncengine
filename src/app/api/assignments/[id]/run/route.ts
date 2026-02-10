import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { triggerImmediateExtraction } from '@/lib/services/scheduler';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        extractionRules: {
          where: { isActive: true }
        }
      }
    });
    
    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    const isLLMMode = assignment.extractionMethod === 'llm';

    if (!isLLMMode && assignment.extractionRules.length === 0) {
      return NextResponse.json(
        { error: 'No extraction rules configured' },
        { status: 400 }
      );
    }

    // Check for valid status
    if (!['draft', 'testing', 'active'].includes(assignment.status)) {
      return NextResponse.json(
        { error: `Cannot run extraction for assignment with status: ${assignment.status}` },
        { status: 400 }
      );
    }

    // Get mode from request body (defaults to assignment's sync mode)
    const body = await request.json().catch(() => ({}));
    const mode = body.mode || assignment.syncMode;

    // Trigger extraction
    const jobId = await triggerImmediateExtraction(id, mode as 'manual' | 'auto');

    // Update assignment status to testing if it was draft
    if (assignment.status === 'draft') {
      await prisma.assignment.update({
        where: { id },
        data: { status: 'testing' }
      });
    }

    // Log the run
    await prisma.auditLog.create({
      data: {
        eventType: 'extraction_triggered',
        eventDetails: JSON.stringify({
          assignmentId: id,
          jobId,
          mode,
          triggeredBy: 'manual'
        }),
        resourceType: 'assignment',
        resourceId: id,
      }
    });

    return NextResponse.json({
      success: true,
      jobId,
      mode,
    });
  } catch (error) {
    console.error('Run extraction error:', error);
    
    if (error instanceof Error && error.message.includes('already running')) {
      return NextResponse.json(
        { error: 'An extraction job is already running for this assignment' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to start extraction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
