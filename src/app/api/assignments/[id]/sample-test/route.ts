import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { runSampleExtraction } from '@/lib/services/extraction-executor';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        webSource: {
          select: { id: true, name: true, baseUrl: true }
        },
        extractionRules: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' }
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
        { error: 'No extraction rules configured. Please set up field mappings first.' },
        { status: 400 }
      );
    }

    // Get optional max rows from request
    const body = await request.json().catch(() => ({}));
    const maxRows = body.maxRows || 5;

    // Run sample extraction
    const result = await runSampleExtraction(id, maxRows);

    // Log the test
    await prisma.auditLog.create({
      data: {
        eventType: 'sample_test_run',
        eventDetails: JSON.stringify({
          assignmentId: id,
          success: result.success,
          rowsExtracted: result.rows.length,
          error: result.error
        }),
        resourceType: 'assignment',
        resourceId: id,
      }
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        rows: [],
      });
    }

    return NextResponse.json({
      success: true,
      rows: result.rows,
      columns: isLLMMode
        ? (result.rows.length > 0 ? Object.keys(result.rows[0]) : [])
        : assignment.extractionRules.map(r => r.targetColumn),
      sourceUrl: assignment.startUrl || assignment.webSource?.baseUrl,
    });
  } catch (error) {
    console.error('Sample test error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Sample test failed'
      },
      { status: 500 }
    );
  }
}
