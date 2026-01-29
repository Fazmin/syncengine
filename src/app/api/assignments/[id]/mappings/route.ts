import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        extractionRules: {
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
    
    return NextResponse.json(assignment.extractionRules);
  } catch (error) {
    console.error('Get mappings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch extraction rules' },
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
    
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    const { rules } = body;
    
    if (!Array.isArray(rules)) {
      return NextResponse.json(
        { error: 'Rules must be an array' },
        { status: 400 }
      );
    }

    // Delete existing rules
    await prisma.extractionRule.deleteMany({
      where: { assignmentId: id }
    });

    // Create new rules
    const createdRules = await Promise.all(
      rules.map((rule: {
        targetColumn: string;
        selector: string;
        selectorType?: string;
        attribute?: string;
        transformType?: string;
        transformConfig?: string | Record<string, unknown>;
        defaultValue?: string;
        dataType?: string;
        isRequired?: boolean;
        validationRegex?: string;
        sortOrder?: number;
        isActive?: boolean;
      }, index: number) => 
        prisma.extractionRule.create({
          data: {
            assignmentId: id,
            targetColumn: rule.targetColumn,
            selector: rule.selector,
            selectorType: rule.selectorType || 'css',
            attribute: rule.attribute || 'text',
            transformType: rule.transformType || null,
            transformConfig: rule.transformConfig 
              ? (typeof rule.transformConfig === 'string' 
                  ? rule.transformConfig 
                  : JSON.stringify(rule.transformConfig))
              : null,
            defaultValue: rule.defaultValue || null,
            dataType: rule.dataType || 'string',
            isRequired: rule.isRequired ?? false,
            validationRegex: rule.validationRegex || null,
            sortOrder: rule.sortOrder ?? index,
            isActive: rule.isActive ?? true,
          }
        })
      )
    );

    // Log the update
    await prisma.auditLog.create({
      data: {
        eventType: 'extraction_rules_updated',
        eventDetails: JSON.stringify({
          assignmentId: id,
          rulesCount: createdRules.length
        }),
        resourceType: 'assignment',
        resourceId: id,
      }
    });

    return NextResponse.json({
      success: true,
      rules: createdRules
    });
  } catch (error) {
    console.error('Update mappings error:', error);
    return NextResponse.json(
      { error: 'Failed to update extraction rules' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Get max sortOrder
    const maxOrder = await prisma.extractionRule.aggregate({
      where: { assignmentId: id },
      _max: { sortOrder: true }
    });

    const rule = await prisma.extractionRule.create({
      data: {
        assignmentId: id,
        targetColumn: body.targetColumn,
        selector: body.selector,
        selectorType: body.selectorType || 'css',
        attribute: body.attribute || 'text',
        transformType: body.transformType || null,
        transformConfig: body.transformConfig 
          ? (typeof body.transformConfig === 'string' 
              ? body.transformConfig 
              : JSON.stringify(body.transformConfig))
          : null,
        defaultValue: body.defaultValue || null,
        dataType: body.dataType || 'string',
        isRequired: body.isRequired ?? false,
        validationRegex: body.validationRegex || null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        isActive: body.isActive ?? true,
      }
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Create mapping error:', error);
    
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A rule for this target column already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create extraction rule' },
      { status: 500 }
    );
  }
}
