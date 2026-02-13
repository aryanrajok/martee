import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  console.log('Refund API called');
  try {
    const body = await request.json();
    console.log('Request body:', body);
    const { orderId, refundTransferHash } = body;

    if (!orderId || !refundTransferHash) {
      return NextResponse.json(
        { error: 'Order ID and refund transaction hash are required' },
        { status: 400 }
      );
    }

    // Check if order exists and is paid
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status !== 'PAID') {
      return NextResponse.json(
        { error: 'Order must be paid to be refunded' },
        { status: 400 }
      );
    }

    if (order.refundTransferHash) {
      return NextResponse.json(
        { error: 'Order has already been refunded' },
        { status: 400 }
      );
    }

    // Update order with refund information
    console.log('Updating order with refund:', { orderId, refundTransferHash });
    
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'REFUNDED',
        refundTransferHash: refundTransferHash,
        refundedAt: new Date()
      }
    });

    console.log('Order updated successfully:', updatedOrder);

    return NextResponse.json({
      success: true,
      order: updatedOrder
    });

  } catch (error) {
    console.error('Error processing refund - Full error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { error: 'Failed to process refund', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}