import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Find all PENDING invoices that have expired
    const expiredInvoices = await prisma.order.updateMany({
      where: {
        status: 'PENDING',
        type: 'DIRECT',
        expiresAt: {
          lte: new Date() // Less than or equal to current time
        }
      },
      data: {
        status: 'EXPIRED'
      }
    });

    console.log(`Marked ${expiredInvoices.count} invoices as expired`);

    return NextResponse.json({
      success: true,
      updatedCount: expiredInvoices.count
    });

  } catch (error) {
    console.error('Error checking expired invoices:', error);
    return NextResponse.json(
      { error: 'Failed to check expired invoices' },
      { status: 500 }
    );
  }
}