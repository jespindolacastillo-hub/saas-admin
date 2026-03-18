import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { getPlanLimits, limitPct } from '../../config/planLimits';
import {
  MessageSquare, Star, Zap, TrendingUp, DollarSign,
  Lock, ArrowUpRight, MapPin, AlertTriangle, CheckCircle2,
  Minus, ChevronRight, Sparkles, Info,
} from 'lucide-react';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  coral:  '#FF5C3A',
  teal:   '#00C9A7',
  purple: '#7C3AED',
  ink:    '#0D0D12',
  bg:     '#F7F8FC',
  card:   '#FFFFFF',
  muted:  '#6B7280',
  border: '#E5E7EB',
  green:  '#16A34A',
  amber:  '#F59E0B',
  red:    '#EF4444',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const calcRevenue = ({ reviewsGen, recovered, ticket = 350 }) =>
  Math.round(reviewsGen * 2.8 * ticket + recovered * ticket * 2.5);

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color, Icon, loading, accent }) {
  const bg = accent || color + '12';
  return (
    <div style={{
      background: T.card, borderRadius: 20, padding: '22px 24px',
      border: `1px solid ${T.border}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, color: T.muted,
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>{label}</span>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} strokeWidth={2} />
        </div>
      </div>
      {loading ? (
        <div style={{ height: 40, background: '#F1F5F9', borderRadius: 10,
          animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <div style={{
          fontSize: '2.2rem', fontWeight: 800, color: color || T.ink,
          fontFamily: font, lineHeight: 1, letterSpacing: '-0.02em',
        }}>{value}</div>
      )}
      {sub && (
        <div style={{ fontSize: '0.78rem', color: T.muted, fontWeight: 500 }}>{sub}</div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}

// ─── Revenue Card ─────────────────────────────────────────────────────────────
function RevenueCard({ reviewsGen, recovered, plan, loading }) {
  const locked = plan === 'free' || plan === 'starter';
  const revenue = calcRevenue({ reviewsGen, recovered });

  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden',
      border: `1px solid ${locked ? T.border : T.coral + '30'}`,
      background: locked
        ? T.card
        : `linear-gradient(135deg, ${T.coral}08 0%, ${T.teal}08 100%)`,
      boxShadow: locked ? 'none' : `0 4px 24px ${T.coral}10`,
    }}>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted,
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
              Impacto en ingresos
            </div>
            {!locked && (
              <div style={{ fontSize: '0.78rem', color: T.muted }}>
                estimado este mes
              </div>
            )}
          </div>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: locked ? '#F1F5F9' : T.coral + '15',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {locked
              ? <Lock size={18} color={T.muted} />
              : <DollarSign size={18} color={T.coral} />}
          </div>
        </div>

        {loading ? (
          <div style={{ height: 44, background: '#F1F5F9', borderRadius: 10 }} />
        ) : locked ? (
          <div>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#CBD5E1',
              filter: 'blur(8px)', userSelect: 'none', letterSpacing: '-0.02em' }}>
              $99,999 MXN
            </div>
            <div style={{ fontSize: '0.82rem', color: T.muted, marginTop: 6 }}>
              Disponible desde el plan Growth
            </div>
            <button style={{
              marginTop: 14, background: T.coral, color: '#fff', border: 'none',
              borderRadius: 10, padding: '8px 18px', fontFamily: font,
              fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Zap size={14} fill="white" /> Mejorar plan
            </button>
          </div>
        ) : (
          <div>
            <div style={{
              fontSize: '2.4rem', fontWeight: 800, color: T.coral,
              fontFamily: font, letterSpacing: '-0.02em', lineHeight: 1,
            }}>
              ${revenue.toLocaleString('es-MX')} <span style={{ fontSize: '1rem', fontWeight: 600, color: T.muted }}>MXN</span>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.teal }} />
                <span style={{ fontSize: '0.78rem', color: T.muted }}>
                  {reviewsGen} reseñas × $2.8 ticket promedio
                </span>
              </div>
              {recovered > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.coral }} />
                  <span style={{ fontSize: '0.78rem', color: T.muted }}>
                    {recovered} recuperados × 2.5×
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Location Breakdown ───────────────────────────────────────────────────────
const COL_DEFS = [
  { key: 'rank',    label: '#',          sortable: false, align: 'center', width: 36 },
  { key: 'name',    label: 'Sucursal',   sortable: true,  align: 'left'  },
  { key: 'total',   label: 'Feedbacks',  sortable: true,  align: 'right' },
  { key: 'avgNum',  label: 'Promedio',   sortable: true,  align: 'right' },
  { key: 'reviews', label: 'Google',     sortable: true,  align: 'right' },
  { key: 'recRate', label: 'Recovery',   sortable: true,  align: 'right' },
  { key: 'unhappy', label: 'Críticos',   sortable: true,  align: 'right' },
];

function scoreColor(avg) {
  if (avg === null) return T.muted;
  if (avg >= 4.2) return T.green;
  if (avg >= 3.5) return T.teal;
  if (avg >= 2.8) return T.amber;
  return T.red;
}

function LocationBreakdown({ feedbacks, locations, loading }) {
  const [sortKey, setSortKey] = useState('avgNum');
  const [sortDir, setSortDir] = useState('desc');

  if (locations.length <= 1) return null;

  const rows = locations.map(loc => {
    const fbs     = feedbacks.filter(f => f.location_id === loc.id);
    const reviews = fbs.filter(f => f.routed_to_google).length;
    const unhappy = fbs.filter(f => f.score <= 2).length;
    const recovered = fbs.filter(f => f.recovery_sent).length;
    const avgNum  = fbs.length ? fbs.reduce((s, f) => s + f.score, 0) / fbs.length : null;
    const recRate = unhappy > 0 ? Math.round((recovered / unhappy) * 100) : null;
    return { ...loc, total: fbs.length, reviews, unhappy, recovered, avgNum, recRate };
  });

  const sorted = [...rows].sort((a, b) => {
    const va = a[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity);
    const vb = b[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity);
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const worstId = sorted.length > 1 && sorted[sorted.length - 1].total >= 3
    ? sorted[sorted.length - 1].id : null;

  const handleSort = key => {
    if (key === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const RANK_COLORS = ['#F59E0B', '#94A3B8', '#CD7C2F'];

  return (
    <div style={{
      background: T.card, borderRadius: 20, border: `1px solid ${T.border}`,
      overflow: 'hidden', marginBottom: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MapPin size={16} color={T.coral} />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: T.ink }}>Por sucursal</h3>
        </div>
        <span style={{
          fontSize: '0.72rem', fontWeight: 600, color: T.muted,
          background: '#F1F5F9', borderRadius: 999, padding: '3px 10px',
        }}>{sorted.length} sucursales</span>
      </div>

      <div style={{ maxHeight: 480, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ background: '#FAFAFA' }}>
              {COL_DEFS.map(col => (
                <th key={col.key} onClick={() => col.sortable && handleSort(col.key)}
                  style={{
                    padding: '9px 14px', textAlign: col.align,
                    fontWeight: 700, color: sortKey === col.key ? T.ink : T.muted,
                    fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em',
                    borderBottom: `1px solid ${T.border}`,
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none', whiteSpace: 'nowrap',
                    width: col.width || 'auto',
                  }}>
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span style={{ marginLeft: 4 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                  {COL_DEFS.map((_, j) => (
                    <td key={j} style={{ padding: '12px 14px' }}>
                      <div style={{
                        height: 12, background: '#F1F5F9', borderRadius: 6,
                        width: j === 1 ? '60%' : '40%',
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sorted.map((loc, i) => {
              const isTop3   = i < 3 && loc.total >= 3;
              const isWorst  = loc.id === worstId;
              const rankColor = RANK_COLORS[i] || T.muted;
              const rowBg = isWorst ? `${T.red}06` : i % 2 === 0 ? '#fff' : '#FAFAFA';

              return (
                <tr key={loc.id} style={{
                  borderBottom: `1px solid ${T.border}`,
                  background: rowBg,
                  borderLeft: isTop3 ? `3px solid ${rankColor}` : isWorst ? `3px solid ${T.red}` : '3px solid transparent',
                }}>
                  {/* Rank */}
                  <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                    {isTop3 ? (
                      <span style={{ fontSize: '1rem' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: T.muted, fontWeight: 600 }}>{i + 1}</span>
                    )}
                  </td>
                  {/* Name */}
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontWeight: 600, color: T.ink }}>{loc.name}</span>
                    {isWorst && (
                      <span style={{
                        marginLeft: 8, fontSize: '0.68rem', fontWeight: 700,
                        color: T.red, background: T.red + '12', borderRadius: 4, padding: '1px 6px',
                      }}>atención</span>
                    )}
                  </td>
                  {/* Total */}
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: T.ink }}>
                    {loc.total || '—'}
                  </td>
                  {/* Avg */}
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    {loc.avgNum !== null ? (
                      <span style={{
                        fontWeight: 800, fontSize: '0.9rem',
                        color: scoreColor(loc.avgNum),
                      }}>
                        {loc.avgNum.toFixed(1)}
                      </span>
                    ) : <span style={{ color: T.muted }}>—</span>}
                  </td>
                  {/* Google */}
                  <td style={{ padding: '11px 14px', textAlign: 'right', color: T.teal, fontWeight: 700 }}>
                    {loc.reviews || <span style={{ color: T.muted }}>0</span>}
                  </td>
                  {/* Recovery */}
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    {loc.recRate !== null ? (
                      <span style={{
                        color: loc.recRate >= 60 ? T.green : T.amber,
                        fontWeight: 700,
                      }}>{loc.recRate}%</span>
                    ) : <span style={{ color: T.muted }}>—</span>}
                  </td>
                  {/* Critical */}
                  <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                    {loc.unhappy > 0 ? (
                      <span style={{
                        color: T.red, fontWeight: 700,
                        background: T.red + '10', borderRadius: 6,
                        padding: '2px 8px',
                      }}>{loc.unhappy}</span>
                    ) : <span style={{ color: T.muted }}>0</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Feedback Table ───────────────────────────────────────────────────────────
const SCORE_COLOR = { 1: T.red, 2: '#FB923C', 3: T.amber, 4: T.teal, 5: T.green };

function ScoreBadge({ score }) {
  const color = SCORE_COLOR[score] || T.muted;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: color + '15', borderRadius: 999,
      padding: '4px 12px',
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color }}>{score}/5</span>
    </div>
  );
}

function FeedbackTable({ rows, locations, loading }) {
  return (
    <div style={{
      background: T.card, borderRadius: 20, border: `1px solid ${T.border}`,
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageSquare size={16} color={T.coral} />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: T.ink }}>Feedbacks recientes</h3>
        </div>
        <span style={{
          fontSize: '0.72rem', fontWeight: 600, color: T.muted,
          background: '#F1F5F9', borderRadius: 999, padding: '3px 10px',
        }}>últimos 50</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#FAFAFA' }}>
              {['Fecha', 'Sucursal', 'Calificación', 'Google', 'Recovery', 'Comentario'].map(h => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left', fontWeight: 700,
                  color: T.muted, fontSize: '0.7rem', textTransform: 'uppercase',
                  letterSpacing: '0.07em', whiteSpace: 'nowrap',
                  borderBottom: `1px solid ${T.border}`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} style={{ padding: '14px 16px' }}>
                      <div style={{
                        height: 14, background: '#F1F5F9', borderRadius: 6,
                        width: j === 5 ? '80%' : '60%',
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '48px', textAlign: 'center' }}>
                  <MessageSquare size={32} color="#E5E7EB" style={{ marginBottom: 12 }} />
                  <div style={{ color: T.muted, fontSize: '0.88rem', fontWeight: 500 }}>
                    Aún no hay feedbacks. Escanea un QR para empezar.
                  </div>
                </td>
              </tr>
            ) : rows.map((r, idx) => {
              const loc = locations.find(l => l.id === r.location_id);
              return (
                <tr key={r.id} style={{
                  borderBottom: `1px solid ${T.border}`,
                  background: idx % 2 === 0 ? '#fff' : '#FAFAFA',
                  transition: 'background 0.15s',
                }}>
                  <td style={{ padding: '12px 16px', color: T.muted, whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                    {format(new Date(r.created_at), 'dd MMM · HH:mm', { locale: es })}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: '0.8rem', fontWeight: 600, color: T.ink,
                      background: T.purple + '10', borderRadius: 6, padding: '3px 8px',
                    }}>
                      {loc?.name || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <ScoreBadge score={r.score} />
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {r.routed_to_google
                      ? <CheckCircle2 size={16} color={T.teal} />
                      : <Minus size={16} color="#D1D5DB" />}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {r.recovery_sent
                      ? <Zap size={16} color={T.coral} />
                      : <Minus size={16} color="#D1D5DB" />}
                  </td>
                  <td style={{
                    padding: '12px 16px', color: T.muted, maxWidth: 220,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontSize: '0.82rem', fontStyle: r.comment ? 'normal' : 'italic',
                  }}>
                    {r.comment || 'Sin comentario'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12,
      padding: '10px 14px', fontSize: '0.8rem', fontFamily: font,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight: 700, color: T.ink, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.muted }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span>{p.name}:</span>
          <span style={{ fontWeight: 700, color: T.ink }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── AI Insights ──────────────────────────────────────────────────────────────
function generateInsights(feedbacks, locations) {
  const insights = [];
  if (feedbacks.length === 0) return insights;

  const total = feedbacks.length;
  const avg = feedbacks.reduce((s, f) => s + f.score, 0) / total;

  // Score trend: compare first half vs second half
  if (total >= 20) {
    const half = Math.floor(total / 2);
    const recentAvg = feedbacks.slice(0, half).reduce((s, f) => s + f.score, 0) / half;
    const oldAvg    = feedbacks.slice(half).reduce((s, f) => s + f.score, 0) / half;
    const diff = recentAvg - oldAvg;
    if (diff > 0.3)
      insights.push({ type: 'success', text: `Tu calificación subió +${diff.toFixed(1)} pts vs el período anterior · momentum positivo` });
    else if (diff < -0.3)
      insights.push({ type: 'warning', text: `Tu calificación bajó ${Math.abs(diff).toFixed(1)} pts vs el período anterior · revisa los issues recientes` });
  }

  // Best/worst location
  const locStats = locations.map(loc => {
    const fbs = feedbacks.filter(f => f.location_id === loc.id);
    return { ...loc, avg: fbs.length ? fbs.reduce((s, f) => s + f.score, 0) / fbs.length : 0, total: fbs.length };
  }).filter(l => l.total >= 3).sort((a, b) => b.avg - a.avg);
  if (locStats.length >= 2) {
    insights.push({ type: 'success', text: `${locStats[0].name} lidera con ${locStats[0].avg.toFixed(1)}/5 · ${locStats[0].total} feedbacks` });
    const worst = locStats[locStats.length - 1];
    if (worst.avg < 3.5)
      insights.push({ type: 'warning', text: `${worst.name} promedia ${worst.avg.toFixed(1)}/5 · oportunidad de mejora inmediata` });
  }

  // Recovery rate
  const unhappy   = feedbacks.filter(f => f.score <= 2).length;
  const recovered = feedbacks.filter(f => f.recovery_sent).length;
  if (unhappy > 0) {
    const rate = Math.round((recovered / unhappy) * 100);
    if (rate >= 70)
      insights.push({ type: 'success', text: `Recovery rate de ${rate}% · recuperaste ${recovered} de ${unhappy} clientes insatisfechos` });
    else if (unhappy - recovered >= 3)
      insights.push({ type: 'tip', text: `${unhappy - recovered} clientes insatisfechos aún sin mensaje de recovery · actívalos desde Issues` });
  }

  // Google conversion
  const googleRate = Math.round((feedbacks.filter(f => f.routed_to_google).length / total) * 100);
  if (googleRate >= 65)
    insights.push({ type: 'success', text: `${googleRate}% de tus clientes satisfechos dejan reseña en Google · muy por encima del promedio del sector` });
  else if (googleRate < 35 && total >= 10)
    insights.push({ type: 'tip', text: `Conversión a Google del ${googleRate}% · ajusta el umbral de redirect en QR Studio para mejorar` });

  // Best day of week
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const byCounts = dayNames.map((name, i) => ({
    name,
    count: feedbacks.filter(f => new Date(f.created_at).getDay() === i).length,
  }));
  const bestDay = byCounts.reduce((a, b) => a.count > b.count ? a : b);
  if (bestDay.count > 0 && total >= 14)
    insights.push({ type: 'info', text: `Los ${bestDay.name} son tu día pico de feedback con ${bestDay.count} respuestas · asegura cobertura de equipo` });

  return insights.slice(0, 4);
}

const INSIGHT_STYLES = {
  success: { dot: T.green,  icon: <TrendingUp  size={14} color={T.green}  />, bg: T.green  + '08' },
  warning: { dot: T.amber,  icon: <AlertTriangle size={14} color={T.amber} />, bg: T.amber  + '08' },
  tip:     { dot: T.teal,   icon: <Zap           size={14} color={T.teal}  />, bg: T.teal   + '08' },
  info:    { dot: T.purple, icon: <Info          size={14} color={T.purple}/>, bg: T.purple + '08' },
};

function InsightsCard({ insights, loading }) {
  return (
    <div style={{
      background: T.card, borderRadius: 20, border: `1px solid ${T.border}`,
      overflow: 'hidden', marginBottom: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        padding: '18px 24px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={16} color={T.purple} />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: T.ink }}>Insights del período</h3>
        </div>
        <span style={{
          fontSize: '0.68rem', fontWeight: 600, color: T.muted,
          background: '#F1F5F9', borderRadius: 999, padding: '3px 10px',
        }}>
          Generado automáticamente · actualiza con cada rango
        </span>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{
                height: 44, background: '#F1F5F9', borderRadius: 12,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: T.muted, fontSize: '0.85rem' }}>
            No hay insights disponibles aún — necesitas más datos.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.map((insight, i) => {
              const style = INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.info;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: style.bg, borderRadius: 12, padding: '12px 16px',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: style.dot, flexShrink: 0,
                  }} />
                  <div style={{ flexShrink: 0 }}>{style.icon}</div>
                  <span style={{ fontSize: '0.83rem', color: T.ink, fontWeight: 500, lineHeight: 1.45 }}>
                    {insight.text}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function RetelioDashboard() {
  const { tenant } = useTenant();
  const [feedbacks,  setFeedbacks]  = useState([]);
  const [locations,  setLocations]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [range,      setRange]      = useState(30);

  useEffect(() => {
    if (tenant?.id) loadData();
  }, [tenant?.id, range]);

  const loadData = async () => {
    setLoading(true);
    const since = subDays(new Date(), range).toISOString();
    const [fbRes, locRes] = await Promise.all([
      supabase
        .from('feedbacks')
        .select('*, qr_codes(label, type)')
        .eq('tenant_id', tenant.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('locations')
        .select('id, name')
        .eq('tenant_id', tenant.id),
    ]);
    if (fbRes.data)  setFeedbacks(fbRes.data);
    if (locRes.data) setLocations(locRes.data);
    setLoading(false);
  };

  const metrics = useMemo(() => {
    const total     = feedbacks.length;
    const reviews   = feedbacks.filter(f => f.routed_to_google).length;
    const unhappy   = feedbacks.filter(f => f.score <= 2).length;
    const recovered = feedbacks.filter(f => f.recovery_sent).length;
    const avgScore  = total
      ? (feedbacks.reduce((s, f) => s + f.score, 0) / total).toFixed(1)
      : '—';
    const recRate = unhappy ? Math.round((recovered / unhappy) * 100) : 0;
    return { total, reviews, unhappy, recovered, avgScore, recRate };
  }, [feedbacks]);

  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), range - 1), end: new Date() });
    return days.map(day => {
      const label  = format(day, 'd MMM', { locale: es });
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayFbs = feedbacks.filter(f => f.created_at.startsWith(dayStr));
      return {
        date:      label,
        Feedbacks: dayFbs.length,
        Reseñas:   dayFbs.filter(f => f.routed_to_google).length,
      };
    });
  }, [feedbacks, range]);

  const scoreData = useMemo(() => (
    [1, 2, 3, 4, 5].map(s => ({
      score: `${s}★`,
      count: feedbacks.filter(f => f.score === s).length,
    }))
  ), [feedbacks]);

  const SCORE_COLORS = [T.red, '#FB923C', T.amber, T.teal, T.green];

  const plan       = tenant?.plan || 'free';
  const planLimits = getPlanLimits(plan);
  const pct        = limitPct(metrics.reviews, planLimits.maxReviewsPerMonth);

  const tickInterval = range <= 7 ? 0 : range <= 30
    ? Math.floor(chartData.length / 6)
    : Math.floor(chartData.length / 8);

  return (
    <div style={{ fontFamily: font, padding: '28px', background: T.bg, minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: '0.85rem', color: T.muted, fontWeight: 500 }}>
            {tenant?.name || 'Tu negocio'} · últimos {range} días
          </p>
        </div>
        <div style={{
          display: 'flex', gap: 4, background: '#F1F5F9',
          borderRadius: 12, padding: 4,
        }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setRange(d)} style={{
              padding: '6px 16px', borderRadius: 9, border: 'none',
              background: range === d ? T.ink : 'transparent',
              color: range === d ? '#fff' : T.muted,
              fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
              fontFamily: font, transition: 'all 0.15s',
            }}>{d}d</button>
          ))}
        </div>
      </div>

      {/* ── Plan limit banner ── */}
      {pct >= 80 && (
        <div style={{
          background: pct >= 100 ? '#FEF2F2' : '#FFFBEB',
          border: `1px solid ${pct >= 100 ? '#FECACA' : '#FDE68A'}`,
          borderRadius: 14, padding: '14px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} color={pct >= 100 ? T.red : T.amber} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: T.ink }}>
              {pct >= 100
                ? `Alcanzaste el límite de ${planLimits.maxReviewsPerMonth} reseñas de tu plan este mes.`
                : `Llevas ${metrics.reviews} de ${planLimits.maxReviewsPerMonth} reseñas (${pct}%).`}
            </span>
          </div>
          <button style={{
            background: T.coral, color: '#fff', border: 'none', borderRadius: 9,
            padding: '7px 16px', fontWeight: 700, fontSize: '0.8rem',
            cursor: 'pointer', fontFamily: font, display: 'flex', alignItems: 'center', gap: 6,
            whiteSpace: 'nowrap',
          }}>
            <Zap size={13} fill="white" /> Mejorar plan
          </button>
        </div>
      )}

      {/* ── Metric cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 20 }}>
        <MetricCard
          label="Feedbacks"
          value={loading ? '—' : metrics.total}
          sub={`últimos ${range} días`}
          color={T.purple}
          Icon={MessageSquare}
          loading={loading}
        />
        <MetricCard
          label="Reseñas Google"
          value={loading ? '—' : metrics.reviews}
          sub={planLimits.maxReviewsPerMonth >= 999999
            ? 'ilimitadas'
            : `${metrics.reviews}/${planLimits.maxReviewsPerMonth} este mes`}
          color={T.teal}
          Icon={Star}
          loading={loading}
        />
        <MetricCard
          label="Recovery rate"
          value={loading ? '—' : `${metrics.recRate}%`}
          sub={`${metrics.recovered} de ${metrics.unhappy} críticos`}
          color={metrics.recRate > 50 ? T.green : metrics.recRate > 0 ? T.amber : T.coral}
          Icon={Zap}
          loading={loading}
        />
        <MetricCard
          label="Calificación ⌀"
          value={loading ? '—' : metrics.avgScore}
          sub="sobre 5 estrellas"
          color={T.ink}
          Icon={TrendingUp}
          loading={loading}
        />
      </div>

      {/* ── Revenue card ── */}
      <div style={{ marginBottom: 20 }}>
        <RevenueCard
          reviewsGen={metrics.reviews}
          recovered={metrics.recovered}
          plan={plan}
          loading={loading}
        />
      </div>

      {/* ── Location breakdown ── */}
      <LocationBreakdown feedbacks={feedbacks} locations={locations} loading={loading} />

      {/* ── Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Trend */}
        <div style={{
          background: T.card, borderRadius: 20, padding: '22px 24px',
          border: `1px solid ${T.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: T.ink }}>Tendencia</h3>
            <div style={{ display: 'flex', gap: 14 }}>
              {[{ c: T.purple, l: 'Feedbacks' }, { c: T.teal, l: 'Reseñas' }].map(({ c, l }) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                  <span style={{ fontSize: '0.72rem', color: T.muted, fontWeight: 600 }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gFb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={T.purple} stopOpacity={0.12} />
                  <stop offset="95%" stopColor={T.purple} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gRv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={T.teal} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={T.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.muted, fontFamily: font }}
                tickLine={false} axisLine={false} interval={tickInterval} />
              <YAxis tick={{ fontSize: 10, fill: T.muted, fontFamily: font }}
                tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="Feedbacks" stroke={T.purple}
                fill="url(#gFb)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: T.purple }} />
              <Area type="monotone" dataKey="Reseñas" stroke={T.teal}
                fill="url(#gRv)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: T.teal }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution */}
        <div style={{
          background: T.card, borderRadius: 20, padding: '22px 24px',
          border: `1px solid ${T.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: T.ink, marginBottom: 20 }}>
            Distribución
          </h3>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={scoreData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="score" tick={{ fontSize: 11, fill: T.muted, fontFamily: font }}
                tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: T.muted, fontFamily: font }}
                tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="count" name="Feedbacks" radius={[8, 8, 0, 0]} maxBarSize={40}>
                {scoreData.map((_, i) => <Cell key={i} fill={SCORE_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Insights ── */}
      <InsightsCard insights={generateInsights(feedbacks, locations)} loading={loading} />

      {/* ── Feedback table ── */}
      <FeedbackTable rows={feedbacks.slice(0, 50)} locations={locations} loading={loading} />

    </div>
  );
}
