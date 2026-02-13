import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      // Return all orders with their status
      const orders = await prisma.order.findMany({
        select: {
          id: true,
          status: true,
          refundTransferHash: true,
          refundedAt: true,
          productName: true,
          totalAmount: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      });
      
      return NextResponse.json({ orders });
    }
    
    // Get specific order
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      order: {
        id: order.id,
        status: order.status,
        refundTransferHash: order.refundTransferHash,
        refundedAt: order.refundedAt,
        transferHash: order.transferHash,
        paidAt: order.paidAt
      }
    });
    
  } catch (error) {
    console.error('Error checking order status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}