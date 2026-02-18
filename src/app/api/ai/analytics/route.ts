import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const merchantWallet = searchParams.get('wallet');

        if (!merchantWallet) {
            return NextResponse.json({ error: 'Missing wallet' }, { status: 400 });
        }

        const wallet = merchantWallet.toLowerCase();

        // ── Fetch all orders for this merchant ──────────────────────────────────
        const allOrders = await prisma.order.findMany({
            where: { merchantWallet: wallet },
            orderBy: { createdAt: 'asc' },
        });

        const paidOrders = allOrders.filter((o) => o.status === 'PAID');
        const pendingOrders = allOrders.filter((o) => o.status === 'PENDING');
        const failedOrders = allOrders.filter((o) => o.status === 'FAILED' || o.status === 'CANCELLED');

        // ── Revenue metrics ─────────────────────────────────────────────────────
        const totalRevenue = paidOrders.reduce((s, o) => s + o.totalAmount, 0);
        const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

        // ── Revenue by day (last 14 days) ───────────────────────────────────────
        const last14Days = Array.from({ length: 14 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (13 - i));
            d.setHours(0, 0, 0, 0);
            return d;
        });

        const revenueByDay = last14Days.map((day) => {
            const nextDay = new Date(day);
            nextDay.setDate(nextDay.getDate() + 1);
            const dayOrders = paidOrders.filter((o) => {
                const paid = new Date(o.paidAt || o.createdAt);
                return paid >= day && paid < nextDay;
            });
            return {
                date: day.toISOString().split('T')[0],
                revenue: dayOrders.reduce((s, o) => s + o.totalAmount, 0),
                count: dayOrders.length,
                label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            };
        });

        // ── Revenue by type ─────────────────────────────────────────────────────
        const revenueByType = {
            DIRECT: paidOrders.filter((o) => o.type === 'DIRECT').reduce((s, o) => s + o.totalAmount, 0),
            SHOPIFY: paidOrders.filter((o) => o.type === 'SHOPIFY').reduce((s, o) => s + o.totalAmount, 0),
            WOOCOMMERCE: paidOrders.filter((o) => o.type === 'WOOCOMMERCE').reduce((s, o) => s + o.totalAmount, 0),
        };

        // ── AI Revenue Prediction (linear regression on last 14 days) ──────────
        const revenueValues = revenueByDay.map((d) => d.revenue);
        const n = revenueValues.length;
        const xMean = (n - 1) / 2;
        const yMean = revenueValues.reduce((s, v) => s + v, 0) / n;
        let numerator = 0;
        let denominator = 0;
        revenueValues.forEach((y, x) => {
            numerator += (x - xMean) * (y - yMean);
            denominator += (x - xMean) ** 2;
        });
        const slope = denominator !== 0 ? numerator / denominator : 0;
        const intercept = yMean - slope * xMean;

        // Predict next 7 days
        const predictions = Array.from({ length: 7 }, (_, i) => {
            const x = n + i;
            const predicted = Math.max(0, slope * x + intercept);
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + i + 1);
            return {
                date: futureDate.toISOString().split('T')[0],
                predicted: Math.round(predicted * 100) / 100,
                label: futureDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            };
        });

        const predictedWeekRevenue = predictions.reduce((s, p) => s + p.predicted, 0);

        // ── Conversion rate ─────────────────────────────────────────────────────
        const conversionRate = allOrders.length > 0
            ? (paidOrders.length / allOrders.length) * 100
            : 0;

        // ── Top products ────────────────────────────────────────────────────────
        const productMap = new Map<string, { count: number; revenue: number }>();
        paidOrders.forEach((o) => {
            const name = o.productName || 'Unknown';
            const existing = productMap.get(name) || { count: 0, revenue: 0 };
            productMap.set(name, {
                count: existing.count + 1,
                revenue: existing.revenue + o.totalAmount,
            });
        });
        const topProducts = Array.from(productMap.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // ── Unique customers ────────────────────────────────────────────────────
        const uniqueCustomers = new Set(paidOrders.map((o) => o.customerWallet).filter(Boolean)).size;
        const repeatCustomers = paidOrders.reduce((acc, o) => {
            if (!o.customerWallet) return acc;
            acc[o.customerWallet] = (acc[o.customerWallet] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const repeatCount = Object.values(repeatCustomers).filter((c) => c > 1).length;

        // ── AI Insights (rule-based intelligence) ───────────────────────────────
        const insights: { type: 'positive' | 'warning' | 'info'; title: string; detail: string }[] = [];

        // Trend insight
        const recentRevenue = revenueValues.slice(-3).reduce((s, v) => s + v, 0);
        const prevRevenue = revenueValues.slice(-6, -3).reduce((s, v) => s + v, 0);
        if (recentRevenue > prevRevenue * 1.2) {
            insights.push({
                type: 'positive',
                title: '📈 Revenue Trending Up',
                detail: `Revenue grew ${Math.round(((recentRevenue - prevRevenue) / Math.max(prevRevenue, 1)) * 100)}% in the last 3 days vs the prior 3 days.`,
            });
        } else if (recentRevenue < prevRevenue * 0.8 && prevRevenue > 0) {
            insights.push({
                type: 'warning',
                title: '📉 Revenue Dip Detected',
                detail: `Revenue dropped ${Math.round(((prevRevenue - recentRevenue) / prevRevenue) * 100)}% in the last 3 days. Check for checkout issues.`,
            });
        }

        // Conversion insight
        if (conversionRate < 50 && allOrders.length > 5) {
            insights.push({
                type: 'warning',
                title: '⚠️ Low Conversion Rate',
                detail: `Only ${conversionRate.toFixed(1)}% of orders are paid. Consider simplifying the checkout flow.`,
            });
        } else if (conversionRate >= 80) {
            insights.push({
                type: 'positive',
                title: '✅ Excellent Conversion Rate',
                detail: `${conversionRate.toFixed(1)}% of orders convert to payments — top tier performance!`,
            });
        }

        // Repeat customer insight
        if (repeatCount > 0) {
            insights.push({
                type: 'positive',
                title: '🔄 Loyal Customers',
                detail: `${repeatCount} customer${repeatCount > 1 ? 's have' : ' has'} made repeat purchases. Focus on retention to grow revenue.`,
            });
        }

        // Prediction insight
        if (slope > 0) {
            insights.push({
                type: 'info',
                title: '🔮 AI Revenue Forecast',
                detail: `Based on your trend, AI predicts ~$${predictedWeekRevenue.toFixed(2)} in revenue over the next 7 days.`,
            });
        }

        // ── Peak hours analysis ─────────────────────────────────────────────────
        const hourCounts = new Array(24).fill(0);
        paidOrders.forEach((o) => {
            const hour = new Date(o.paidAt || o.createdAt).getHours();
            hourCounts[hour]++;
        });
        const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
        const peakHourLabel = `${peakHour}:00 - ${peakHour + 1}:00`;

        return NextResponse.json({
            overview: {
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalOrders: allOrders.length,
                paidOrders: paidOrders.length,
                pendingOrders: pendingOrders.length,
                failedOrders: failedOrders.length,
                avgOrderValue: Math.round(avgOrderValue * 100) / 100,
                conversionRate: Math.round(conversionRate * 10) / 10,
                uniqueCustomers,
                repeatCustomers: repeatCount,
            },
            revenueByDay,
            predictions,
            predictedWeekRevenue: Math.round(predictedWeekRevenue * 100) / 100,
            revenueByType,
            topProducts,
            insights,
            peakHour: peakHourLabel,
            hourCounts,
        });
    } catch (error) {
        console.error('Analytics error:', error);
        return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 });
    }
}
