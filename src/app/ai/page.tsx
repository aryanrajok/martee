'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────
interface DayRevenue {
    date: string;
    revenue: number;
    count: number;
    label: string;
}

interface Prediction {
    date: string;
    predicted: number;
    label: string;
}

interface Insight {
    type: 'positive' | 'warning' | 'info';
    title: string;
    detail: string;
}

interface Analytics {
    overview: {
        totalRevenue: number;
        totalOrders: number;
        paidOrders: number;
        pendingOrders: number;
        failedOrders: number;
        avgOrderValue: number;
        conversionRate: number;
        uniqueCustomers: number;
        repeatCustomers: number;
    };
    revenueByDay: DayRevenue[];
    predictions: Prediction[];
    predictedWeekRevenue: number;
    revenueByType: { DIRECT: number; SHOPIFY: number; WOOCOMMERCE: number };
    topProducts: { name: string; count: number; revenue: number }[];
    insights: Insight[];
    peakHour: string;
}

interface FraudOrder {
    orderId: string;
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    amount: number;
    customerWallet?: string;
    status: string;
    createdAt: string;
}

interface FraudSummary {
    orders: FraudOrder[];
    summary: {
        total: number;
        highRiskCount: number;
        avgRiskScore: number;
        safeCount: number;
    };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const riskColor = (level: string) => {
    switch (level) {
        case 'LOW': return { bg: 'rgba(16,185,129,0.15)', text: '#10b981', border: 'rgba(16,185,129,0.3)' };
        case 'MEDIUM': return { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' };
        case 'HIGH': return { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' };
        case 'CRITICAL': return { bg: 'rgba(139,0,0,0.25)', text: '#ff2222', border: 'rgba(255,34,34,0.5)' };
        default: return { bg: 'rgba(99,102,241,0.15)', text: '#6366f1', border: 'rgba(99,102,241,0.3)' };
    }
};

const insightColor = (type: string) => {
    switch (type) {
        case 'positive': return { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', icon: '✅' };
        case 'warning': return { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', icon: '⚠️' };
        default: return { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.3)', icon: '💡' };
    }
};

// ── Mini Bar Chart ────────────────────────────────────────────────────────────
function BarChart({ data, predictions }: { data: DayRevenue[]; predictions: Prediction[] }) {
    const allValues = [...data.map(d => d.revenue), ...predictions.map(p => p.predicted)];
    const maxVal = Math.max(...allValues, 1);

    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px', padding: '0 4px' }}>
            {data.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div
                        style={{
                            width: '100%',
                            height: `${Math.max((d.revenue / maxVal) * 100, 2)}%`,
                            background: 'linear-gradient(180deg, #6366f1, #8b5cf6)',
                            borderRadius: '3px 3px 0 0',
                            transition: 'height 0.5s ease',
                            minHeight: d.revenue > 0 ? '4px' : '2px',
                            opacity: 0.9,
                        }}
                        title={`${d.label}: $${d.revenue}`}
                    />
                </div>
            ))}
            {predictions.slice(0, 4).map((p, i) => (
                <div key={`p${i}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div
                        style={{
                            width: '100%',
                            height: `${Math.max((p.predicted / maxVal) * 100, 2)}%`,
                            background: 'linear-gradient(180deg, rgba(99,102,241,0.4), rgba(139,92,246,0.4))',
                            borderRadius: '3px 3px 0 0',
                            border: '1px dashed rgba(99,102,241,0.6)',
                            minHeight: p.predicted > 0 ? '4px' : '2px',
                        }}
                        title={`${p.label} (predicted): $${p.predicted}`}
                    />
                </div>
            ))}
        </div>
    );
}

// ── Risk Gauge ────────────────────────────────────────────────────────────────
function RiskGauge({ score }: { score: number }) {
    const angle = (score / 100) * 180 - 90;
    const color = score <= 20 ? '#10b981' : score <= 45 ? '#f59e0b' : score <= 70 ? '#ef4444' : '#ff2222';

    return (
        <div style={{ position: 'relative', width: '120px', height: '65px', margin: '0 auto' }}>
            <svg width="120" height="65" viewBox="0 0 120 65">
                {/* Background arc */}
                <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" strokeLinecap="round" />
                {/* Colored arc */}
                <path
                    d="M 10 60 A 50 50 0 0 1 110 60"
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(score / 100) * 157} 157`}
                    style={{ transition: 'stroke-dasharray 1s ease, stroke 0.5s ease' }}
                />
                {/* Needle */}
                <line
                    x1="60" y1="60"
                    x2={60 + 40 * Math.cos(((angle - 90) * Math.PI) / 180)}
                    y2={60 + 40 * Math.sin(((angle - 90) * Math.PI) / 180)}
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    style={{ transition: 'all 1s ease' }}
                />
                <circle cx="60" cy="60" r="4" fill="white" />
            </svg>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', fontSize: '20px', fontWeight: 700, color }}>
                {score}
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIPage() {
    const { address, isConnected } = useAccount();
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [fraud, setFraud] = useState<FraudSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'analytics' | 'fraud'>('analytics');
    const [testWallet, setTestWallet] = useState('');
    const [testAmount, setTestAmount] = useState('');
    const [liveScore, setLiveScore] = useState<null | {
        score: number; level: string; signals: { name: string; triggered: boolean; detail: string }[]; recommendation: string;
    }>(null);
    const [scoring, setScoring] = useState(false);

    const fetchData = useCallback(async () => {
        if (!address) return;
        setLoading(true);
        try {
            const [analyticsRes, fraudRes] = await Promise.all([
                fetch(`/api/ai/analytics?wallet=${address.toLowerCase()}`),
                fetch(`/api/ai/fraud-score?wallet=${address.toLowerCase()}`),
            ]);
            if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
            if (fraudRes.ok) setFraud(await fraudRes.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [address]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const runLiveFraudCheck = async () => {
        if (!testWallet || !testAmount) return;
        setScoring(true);
        setLiveScore(null);
        try {
            const res = await fetch('/api/ai/fraud-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: testWallet, amount: parseFloat(testAmount), merchantWallet: address }),
            });
            if (res.ok) setLiveScore(await res.json());
        } catch (e) { console.error(e); }
        finally { setScoring(false); }
    };

    if (!isConnected) {
        return (
            <div style={styles.centered}>
                <div style={styles.connectCard}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
                    <h1 style={{ color: 'white', fontSize: '24px', marginBottom: '8px' }}>Cartee AI</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>Connect your wallet to access AI insights</p>
                    <ConnectButton />
                </div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            {/* ── Header ── */}
            <div style={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '14px' }}>← Dashboard</Link>
                    <div style={styles.aiChip}>🤖 AI Powered</div>
                    <h1 style={styles.headerTitle}>Cartee AI Intelligence</h1>
                </div>
                <ConnectButton />
            </div>

            {/* ── Tabs ── */}
            <div style={styles.tabs}>
                {(['analytics', 'fraud'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
                    >
                        {tab === 'analytics' ? '📊 Analytics & Predictions' : '🛡️ Fraud Detection'}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={styles.centered}>
                    <div style={styles.spinner} />
                    <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '16px' }}>AI is analyzing your data...</p>
                </div>
            ) : (
                <>
                    {/* ════════════════════════════════════════════════════════════════
              ANALYTICS TAB
          ════════════════════════════════════════════════════════════════ */}
                    {activeTab === 'analytics' && analytics && (
                        <div style={styles.content}>

                            {/* KPI Cards */}
                            <div style={styles.kpiGrid}>
                                {[
                                    { label: 'Total Revenue', value: `$${analytics.overview.totalRevenue.toFixed(2)}`, icon: '💰', color: '#10b981' },
                                    { label: 'Paid Orders', value: analytics.overview.paidOrders, icon: '✅', color: '#6366f1' },
                                    { label: 'Conversion Rate', value: `${analytics.overview.conversionRate}%`, icon: '📈', color: '#f59e0b' },
                                    { label: 'Avg Order Value', value: `$${analytics.overview.avgOrderValue.toFixed(2)}`, icon: '🎯', color: '#8b5cf6' },
                                    { label: 'Unique Customers', value: analytics.overview.uniqueCustomers, icon: '👥', color: '#06b6d4' },
                                    { label: 'Repeat Customers', value: analytics.overview.repeatCustomers, icon: '🔄', color: '#ec4899' },
                                ].map((kpi, i) => (
                                    <div key={i} style={styles.kpiCard}>
                                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>{kpi.icon}</div>
                                        <div style={{ fontSize: '26px', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>{kpi.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Revenue Chart + Prediction */}
                            <div style={styles.twoCol}>
                                <div style={styles.card}>
                                    <div style={styles.cardHeader}>
                                        <span>📊 Revenue Trend (14 days + 4-day AI Forecast)</span>
                                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                                            <span style={{ color: '#6366f1' }}>■</span> Actual &nbsp;
                                            <span style={{ color: 'rgba(99,102,241,0.5)' }}>■</span> Predicted
                                        </span>
                                    </div>
                                    <BarChart data={analytics.revenueByDay} predictions={analytics.predictions} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                                        {[...analytics.revenueByDay.slice(-7), ...analytics.predictions.slice(0, 4)].map((d, i) => (
                                            <div key={i} style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', flex: 1 }}>
                                                {'label' in d ? d.label : ''}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={styles.card}>
                                    <div style={styles.cardHeader}>🔮 AI Revenue Forecast</div>
                                    <div style={{ padding: '8px 0' }}>
                                        <div style={styles.forecastBig}>
                                            ${analytics.predictedWeekRevenue.toFixed(2)}
                                        </div>
                                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textAlign: 'center', marginBottom: '20px' }}>
                                            Predicted revenue — next 7 days
                                        </div>
                                        {analytics.predictions.map((p, i) => (
                                            <div key={i} style={styles.predRow}>
                                                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>{p.label}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        width: `${Math.min((p.predicted / Math.max(...analytics.predictions.map(x => x.predicted), 1)) * 80, 80)}px`,
                                                        height: '6px',
                                                        background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                                                        borderRadius: '3px',
                                                    }} />
                                                    <span style={{ color: '#a5b4fc', fontSize: '13px', fontWeight: 600 }}>${p.predicted.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* AI Insights + Top Products */}
                            <div style={styles.twoCol}>
                                <div style={styles.card}>
                                    <div style={styles.cardHeader}>🧠 AI Insights</div>
                                    {analytics.insights.length === 0 ? (
                                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Not enough data yet. Make more sales to unlock AI insights!</p>
                                    ) : (
                                        analytics.insights.map((ins, i) => {
                                            const c = insightColor(ins.type);
                                            return (
                                                <div key={i} style={{ ...styles.insightCard, background: c.bg, borderColor: c.border }}>
                                                    <div style={{ fontWeight: 600, color: 'white', fontSize: '14px', marginBottom: '4px' }}>{ins.title}</div>
                                                    <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', lineHeight: 1.5 }}>{ins.detail}</div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div style={styles.card}>
                                    <div style={styles.cardHeader}>🏆 Top Products</div>
                                    {analytics.topProducts.length === 0 ? (
                                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No paid orders yet.</p>
                                    ) : (
                                        analytics.topProducts.map((p, i) => (
                                            <div key={i} style={styles.productRow}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={styles.productRank}>{i + 1}</div>
                                                    <div>
                                                        <div style={{ color: 'white', fontSize: '14px', fontWeight: 500 }}>{p.name}</div>
                                                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{p.count} sale{p.count !== 1 ? 's' : ''}</div>
                                                    </div>
                                                </div>
                                                <div style={{ color: '#10b981', fontWeight: 700 }}>${p.revenue.toFixed(2)}</div>
                                            </div>
                                        ))
                                    )}

                                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                        <div style={styles.cardHeader}>📦 Revenue by Channel</div>
                                        {Object.entries(analytics.revenueByType).map(([type, rev]) => (
                                            <div key={type} style={styles.predRow}>
                                                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>{type}</span>
                                                <span style={{ color: '#a5b4fc', fontWeight: 600 }}>${(rev as number).toFixed(2)}</span>
                                            </div>
                                        ))}
                                        <div style={{ marginTop: '12px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                                            ⏰ Peak payment hour: <strong style={{ color: 'white' }}>{analytics.peakHour}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════════════════════
              FRAUD TAB
          ════════════════════════════════════════════════════════════════ */}
                    {activeTab === 'fraud' && (
                        <div style={styles.content}>

                            {/* Summary cards */}
                            {fraud && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                    {[
                                        { label: 'Total Analyzed', value: fraud.summary.total, icon: '🔍', color: '#6366f1' },
                                        { label: 'High Risk Orders', value: fraud.summary.highRiskCount, icon: '🚨', color: '#ef4444' },
                                        { label: 'Avg Risk Score', value: `${fraud.summary.avgRiskScore}/100`, icon: '📊', color: '#f59e0b' },
                                        { label: 'Safe Orders', value: fraud.summary.safeCount, icon: '✅', color: '#10b981' },
                                    ].map((s, i) => (
                                        <div key={i} style={styles.kpiCard}>
                                            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{s.icon}</div>
                                            <div style={{ fontSize: '26px', fontWeight: 700, color: s.color }}>{s.value}</div>
                                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={styles.twoCol}>
                                {/* Live Fraud Checker */}
                                <div style={styles.card}>
                                    <div style={styles.cardHeader}>⚡ Live Fraud Checker</div>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '16px' }}>
                                        Enter a wallet address and amount to get an instant AI fraud risk score.
                                    </p>
                                    <input
                                        style={styles.input}
                                        placeholder="0x... customer wallet address"
                                        value={testWallet}
                                        onChange={(e) => setTestWallet(e.target.value)}
                                    />
                                    <input
                                        style={{ ...styles.input, marginTop: '10px' }}
                                        placeholder="Amount in USD (e.g. 50)"
                                        type="number"
                                        value={testAmount}
                                        onChange={(e) => setTestAmount(e.target.value)}
                                    />
                                    <button
                                        style={{ ...styles.btn, marginTop: '12px', opacity: scoring ? 0.6 : 1 }}
                                        onClick={runLiveFraudCheck}
                                        disabled={scoring}
                                    >
                                        {scoring ? '🔄 Analyzing...' : '🛡️ Run Fraud Check'}
                                    </button>

                                    {liveScore && (
                                        <div style={{ marginTop: '20px' }}>
                                            <RiskGauge score={liveScore.score} />
                                            <div style={{
                                                textAlign: 'center', marginTop: '8px',
                                                ...riskColor(liveScore.level),
                                                padding: '6px 16px', borderRadius: '20px',
                                                border: `1px solid ${riskColor(liveScore.level).border}`,
                                                display: 'inline-block', margin: '8px auto', fontSize: '13px', fontWeight: 700,
                                            }}>
                                                {liveScore.level} RISK
                                            </div>
                                            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>
                                                {liveScore.recommendation}
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {liveScore.signals.map((sig, i) => (
                                                    <div key={i} style={{
                                                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                                                        padding: '10px 12px', borderRadius: '8px',
                                                        background: sig.triggered ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.08)',
                                                        border: `1px solid ${sig.triggered ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.2)'}`,
                                                    }}>
                                                        <span style={{ fontSize: '16px', marginTop: '1px' }}>{sig.triggered ? '🔴' : '🟢'}</span>
                                                        <div>
                                                            <div style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{sig.name}</div>
                                                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{sig.detail}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Order Risk Table */}
                                <div style={styles.card}>
                                    <div style={styles.cardHeader}>📋 Order Risk Analysis</div>
                                    {!fraud || fraud.orders.length === 0 ? (
                                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No orders to analyze yet.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
                                            {fraud.orders.map((o, i) => {
                                                const c = riskColor(o.level);
                                                return (
                                                    <div key={i} style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        padding: '10px 14px', borderRadius: '10px',
                                                        background: c.bg, border: `1px solid ${c.border}`,
                                                    }}>
                                                        <div>
                                                            <div style={{ color: 'white', fontSize: '12px', fontFamily: 'monospace' }}>
                                                                {o.orderId.slice(0, 20)}...
                                                            </div>
                                                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '2px' }}>
                                                                ${o.amount} · {o.status} · {new Date(o.createdAt).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ color: c.text, fontWeight: 700, fontSize: '14px' }}>{o.score}</div>
                                                            <div style={{ color: c.text, fontSize: '10px', fontWeight: 600 }}>{o.level}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 50%, #0a0a1a 100%)',
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: 'white',
        padding: '0 0 60px',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
    },
    headerTitle: {
        fontSize: '20px',
        fontWeight: 700,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        margin: 0,
    },
    aiChip: {
        background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))',
        border: '1px solid rgba(99,102,241,0.4)',
        borderRadius: '20px',
        padding: '4px 12px',
        fontSize: '12px',
        color: '#a5b4fc',
        fontWeight: 600,
    },
    tabs: {
        display: 'flex',
        gap: '4px',
        padding: '20px 32px 0',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
    },
    tab: {
        padding: '10px 24px',
        borderRadius: '8px 8px 0 0',
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        borderLeft: 'none',
        background: 'transparent',
        color: 'rgba(255,255,255,0.5)',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        transition: 'all 0.2s',
    },
    tabActive: {
        background: 'rgba(99,102,241,0.15)',
        color: '#a5b4fc',
        borderBottom: '2px solid #6366f1',
    },
    content: {
        padding: '28px 32px',
    },
    kpiGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '16px',
        marginBottom: '24px',
    },
    kpiCard: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '20px 16px',
        textAlign: 'center',
        backdropFilter: 'blur(10px)',
        transition: 'transform 0.2s, border-color 0.2s',
    },
    twoCol: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '24px',
    },
    card: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '24px',
        backdropFilter: 'blur(10px)',
    },
    cardHeader: {
        fontSize: '15px',
        fontWeight: 600,
        color: 'rgba(255,255,255,0.85)',
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    forecastBig: {
        fontSize: '42px',
        fontWeight: 800,
        textAlign: 'center',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: '4px',
    },
    predRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    insightCard: {
        padding: '14px 16px',
        borderRadius: '12px',
        border: '1px solid',
        marginBottom: '10px',
    },
    productRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    productRank: {
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 700,
        flexShrink: 0,
    },
    input: {
        width: '100%',
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '10px',
        color: 'white',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
    },
    btn: {
        width: '100%',
        padding: '12px',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        border: 'none',
        borderRadius: '10px',
        color: 'white',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'opacity 0.2s',
    },
    centered: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
    },
    connectCard: {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px',
        padding: '48px',
        textAlign: 'center',
        backdropFilter: 'blur(20px)',
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '3px solid rgba(99,102,241,0.2)',
        borderTop: '3px solid #6366f1',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
    },
};
