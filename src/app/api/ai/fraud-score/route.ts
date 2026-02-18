import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface FraudSignal {
    name: string;
    weight: number;
    triggered: boolean;
    detail: string;
}

interface FraudResult {
    score: number;           // 0-100 (higher = more risky)
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    signals: FraudSignal[];
    recommendation: string;
    walletAge: string;
    transactionCount: number;
    totalSpent: number;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { walletAddress, amount, merchantWallet, orderId } = body;

        if (!walletAddress || !amount) {
            return NextResponse.json({ error: 'Missing walletAddress or amount' }, { status: 400 });
        }

        const wallet = walletAddress.toLowerCase();
        const signals: FraudSignal[] = [];
        let totalScore = 0;

        // ── Signal 1: New wallet (no prior orders) ──────────────────────────────
        const priorOrders = await prisma.order.findMany({
            where: { customerWallet: wallet, status: 'PAID' },
            orderBy: { createdAt: 'asc' },
        });

        const isNewWallet = priorOrders.length === 0;
        const walletAgeSignal: FraudSignal = {
            name: 'New Wallet',
            weight: 20,
            triggered: isNewWallet,
            detail: isNewWallet
                ? 'Wallet has no prior payment history'
                : `Wallet has ${priorOrders.length} prior successful payments`,
        };
        signals.push(walletAgeSignal);
        if (isNewWallet) totalScore += 20;

        // ── Signal 2: Unusually large amount ────────────────────────────────────
        const allOrders = await prisma.order.findMany({
            where: { status: 'PAID' },
            select: { totalAmount: true },
        });
        const avgAmount =
            allOrders.length > 0
                ? allOrders.reduce((s, o) => s + o.totalAmount, 0) / allOrders.length
                : 50;
        const isLargeAmount = amount > avgAmount * 5;
        const largeAmountSignal: FraudSignal = {
            name: 'Unusual Amount',
            weight: 25,
            triggered: isLargeAmount,
            detail: isLargeAmount
                ? `Amount $${amount} is ${(amount / avgAmount).toFixed(1)}x above average ($${avgAmount.toFixed(2)})`
                : `Amount $${amount} is within normal range (avg: $${avgAmount.toFixed(2)})`,
        };
        signals.push(largeAmountSignal);
        if (isLargeAmount) totalScore += 25;

        // ── Signal 3: High velocity (many orders in short time) ─────────────────
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentOrders = await prisma.order.findMany({
            where: {
                customerWallet: wallet,
                createdAt: { gte: oneHourAgo },
            },
        });
        const isHighVelocity = recentOrders.length >= 3;
        const velocitySignal: FraudSignal = {
            name: 'High Velocity',
            weight: 30,
            triggered: isHighVelocity,
            detail: isHighVelocity
                ? `${recentOrders.length} orders placed in the last hour`
                : `${recentOrders.length} orders in the last hour (normal)`,
        };
        signals.push(velocitySignal);
        if (isHighVelocity) totalScore += 30;

        // ── Signal 4: Multiple merchants targeted ───────────────────────────────
        const uniqueMerchants = new Set(
            priorOrders.map((o) => o.merchantWallet).filter(Boolean)
        );
        const isMultiMerchant = uniqueMerchants.size >= 5;
        const multiMerchantSignal: FraudSignal = {
            name: 'Multi-Merchant Pattern',
            weight: 15,
            triggered: isMultiMerchant,
            detail: isMultiMerchant
                ? `Wallet has transacted with ${uniqueMerchants.size} different merchants`
                : `Wallet has transacted with ${uniqueMerchants.size} merchant(s)`,
        };
        signals.push(multiMerchantSignal);
        if (isMultiMerchant) totalScore += 15;

        // ── Signal 5: Repeated failed attempts ──────────────────────────────────
        const failedOrders = await prisma.order.findMany({
            where: { customerWallet: wallet, status: 'FAILED' },
        });
        const hasFailedAttempts = failedOrders.length >= 2;
        const failedSignal: FraudSignal = {
            name: 'Failed Attempts',
            weight: 10,
            triggered: hasFailedAttempts,
            detail: hasFailedAttempts
                ? `${failedOrders.length} failed payment attempts on record`
                : 'No failed payment attempts',
        };
        signals.push(failedSignal);
        if (hasFailedAttempts) totalScore += 10;

        // ── Determine risk level ─────────────────────────────────────────────────
        const score = Math.min(totalScore, 100);
        let level: FraudResult['level'];
        let recommendation: string;

        if (score <= 20) {
            level = 'LOW';
            recommendation = 'Transaction appears safe. Proceed normally.';
        } else if (score <= 45) {
            level = 'MEDIUM';
            recommendation = 'Some risk signals detected. Monitor this transaction.';
        } else if (score <= 70) {
            level = 'HIGH';
            recommendation = 'High risk detected. Consider requiring additional verification.';
        } else {
            level = 'CRITICAL';
            recommendation = 'Critical risk! Multiple fraud signals triggered. Block or manually review.';
        }

        const totalSpent = priorOrders.reduce((s, o) => s + o.totalAmount, 0);
        const firstOrder = priorOrders[0];
        const walletAge = firstOrder
            ? `${Math.floor((Date.now() - new Date(firstOrder.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days`
            : 'New wallet';

        const result: FraudResult = {
            score,
            level,
            signals,
            recommendation,
            walletAge,
            transactionCount: priorOrders.length,
            totalSpent,
        };

        // Log the fraud check for analytics
        console.log(`[FRAUD CHECK] wallet=${wallet} score=${score} level=${level} amount=${amount}`);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Fraud score error:', error);
        return NextResponse.json({ error: 'Failed to compute fraud score' }, { status: 500 });
    }
}

// GET: Batch fraud analysis for all recent orders (for dashboard)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const merchantWallet = searchParams.get('wallet');

        if (!merchantWallet) {
            return NextResponse.json({ error: 'Missing wallet' }, { status: 400 });
        }

        // Get recent orders for this merchant
        const orders = await prisma.order.findMany({
            where: { merchantWallet: merchantWallet.toLowerCase() },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        // Score each order with a customer wallet
        const scored = await Promise.all(
            orders.map(async (order) => {
                if (!order.customerWallet) {
                    return { orderId: order.id, score: 0, level: 'LOW' as const, amount: order.totalAmount };
                }

                const wallet = order.customerWallet.toLowerCase();

                // Quick heuristic scoring (lightweight version for batch)
                const priorPaid = await prisma.order.count({
                    where: { customerWallet: wallet, status: 'PAID' },
                });
                const recentCount = await prisma.order.count({
                    where: {
                        customerWallet: wallet,
                        createdAt: { gte: new Date(Date.now() - 3600000) },
                    },
                });

                let score = 0;
                if (priorPaid === 0) score += 20;
                if (recentCount >= 3) score += 30;
                if (order.totalAmount > 100) score += 15;

                const level =
                    score <= 20 ? 'LOW' :
                        score <= 45 ? 'MEDIUM' :
                            score <= 70 ? 'HIGH' : 'CRITICAL';

                return {
                    orderId: order.id,
                    score,
                    level,
                    amount: order.totalAmount,
                    customerWallet: order.customerWallet,
                    status: order.status,
                    createdAt: order.createdAt,
                };
            })
        );

        // Summary stats
        const highRisk = scored.filter((s) => s.level === 'HIGH' || s.level === 'CRITICAL');
        const avgScore = scored.length > 0
            ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length
            : 0;

        return NextResponse.json({
            orders: scored,
            summary: {
                total: scored.length,
                highRiskCount: highRisk.length,
                avgRiskScore: Math.round(avgScore),
                safeCount: scored.filter((s) => s.level === 'LOW').length,
            },
        });
    } catch (error) {
        console.error('Batch fraud analysis error:', error);
        return NextResponse.json({ error: 'Failed to analyze orders' }, { status: 500 });
    }
}
