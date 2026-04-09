import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { getPlanLimits, limitPct, isActiveTrial } from '../../config/planLimits';
import {
  MessageSquare, Star, Zap, TrendingUp, DollarSign,
  Lock, ArrowUpRight, MapPin, AlertTriangle, CheckCircle2,
  Minus, ChevronRight, Sparkles, Info, ChevronDown, X, Search,
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

// ─── NPS Card ─────────────────────────────────────────────────────────────────
function NPSCard({ nps, breakdown, loading, range }) {
  const color = nps === null ? T.muted : nps >= 50 ? T.green : nps >= 20 ? T.teal : nps >= 0 ? T.amber : T.red;

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
        }}>NPS</span>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <TrendingUp size={18} color={color} strokeWidth={2} />
        </div>
      </div>

      {loading ? (
        <div style={{ height: 40, background: '#F1F5F9', borderRadius: 10,
          animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <div style={{
          fontSize: '2.2rem', fontWeight: 800, color,
          fontFamily: font, lineHeight: 1, letterSpacing: '-0.02em',
        }}>
          {nps === null ? '—' : (nps > 0 ? `+${nps}` : `${nps}`)}
        </div>
      )}

      <div style={{ fontSize: '0.78rem', color: T.muted, fontWeight: 500 }}>últimos {range} días</div>

      {!loading && breakdown && (
        <div style={{ marginTop: 2 }}>
          {/* Stacked bar */}
          <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', gap: 2, marginBottom: 8 }}>
            <div style={{ width: `${breakdown.promotersPct}%`, background: T.green, borderRadius: 999 }} />
            <div style={{ width: `${breakdown.passivesPct}%`, background: T.amber, borderRadius: 999 }} />
            <div style={{ width: `${breakdown.detractorsPct}%`, background: T.red, borderRadius: 999 }} />
          </div>
          {/* Labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {[
              { pct: breakdown.promotersPct, label: 'Prom.', color: T.green },
              { pct: breakdown.passivesPct,  label: 'Pasiv.', color: T.amber },
              { pct: breakdown.detractorsPct,label: 'Detr.', color: T.red },
            ].map(({ pct, label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.68rem', color: T.muted, fontWeight: 600 }}>{pct}% {label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
function RevenueCard({ reviewsGen, recovered, plan, isTrial, loading }) {
  const locked = !isTrial && (plan === 'free' || plan === 'starter');
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
  { key: 'reviews', label: 'Clicks Google', sortable: true,  align: 'right' },
  { key: 'recRate', label: 'Canjes',       sortable: true,  align: 'right' },
  { key: 'unhappy', label: 'Análisis',     sortable: true,  align: 'right' },
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
    const reviews = fbs.filter(f => f.google_click_at || f.routed_to_google).length;
    const unhappy = fbs.filter(f => f.score <= 2).length;
    const sent      = fbs.filter(f => f.recovery_sent).length;
    const redeemed  = fbs.filter(f => f.coupon_redeemed).length;
    const avgNum  = fbs.length ? fbs.reduce((s, f) => s + (f.score ?? f.satisfaccion ?? 0), 0) / fbs.length : null;
    const recRate = sent > 0 ? Math.round((redeemed / sent) * 100) : null;
    return { ...loc, total: fbs.length, reviews, unhappy, sent, redeemed, avgNum, recRate };
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

// ─── Feedback Drawer ──────────────────────────────────────────────────────────
const NPS_CATEGORY = s => s === 5 ? { label: 'Promotor', color: T.green } : s >= 3 ? { label: 'Pasivo', color: T.amber } : { label: 'Detractor', color: T.red };

function ActionPanel({ feedback, tenant, onUpdate }) {
  const [step, setStep]     = useState('idle');   // idle | preview | done
  const [action, setAction] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const score    = feedback.score;
  const hasPhone = !!feedback.contact_phone;
  const bizName  = tenant?.name || 'nuestro negocio';

  const ACTIONS = score <= 2 ? [
    { key: 'recovery', label: 'Enviar recovery',      color: T.red,    icon: '🚨', disabled: feedback.recovery_sent },
    { key: 'google',   label: 'Pedir reseña Google',  color: T.muted,  icon: '⭐', disabled: feedback.routed_to_google },
  ] : score <= 4 ? [
    { key: 'recovery', label: 'Enviar recovery',      color: T.amber,  icon: '💌', disabled: feedback.recovery_sent },
    { key: 'google',   label: 'Pedir reseña Google',  color: T.teal,   icon: '⭐', disabled: feedback.routed_to_google },
  ] : [
    { key: 'google',   label: 'Pedir reseña Google',  color: T.teal,   icon: '⭐', disabled: feedback.routed_to_google },
    { key: 'reward',   label: 'Enviar recompensa',    color: T.purple, icon: '🎁', disabled: false },
  ];

  const MESSAGES = {
    recovery: `Hola! Somos del equipo de ${bizName}. Notamos que tu experiencia reciente no fue la mejor y queremos resolverlo. ¿Podemos ayudarte? 🙏`,
    google:   `Hola! Gracias por visitarnos en ${bizName}. Tu opinión nos ayuda mucho — ¿podrías dejarnos una reseña rápida en Google? ⭐ Te lo agradeceríamos muchísimo.`,
    reward:   `Hola! En ${bizName} queremos agradecerte por tu visita y tu buena valoración 🎁. Como muestra de aprecio, tenemos un regalo especial para ti en tu próxima visita. ¡Esperamos verte pronto!`,
  };

  const DB_UPDATES = {
    recovery: { recovery_sent: true },
    google:   { routed_to_google: true },
    reward:   {},
  };

  const handleSelect = (key) => { setAction(key); setStep('preview'); };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(MESSAGES[action]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = async () => {
    setSaving(true);
    const updates = DB_UPDATES[action];
    if (Object.keys(updates).length > 0) {
      await supabase.from('feedbacks').update(updates).eq('id', feedback.id);
      onUpdate({ ...feedback, ...updates });
    }
    setSaving(false);
    setStep('done');
  };

  if (step === 'done') return (
    <div style={{ background: T.green + '10', border: `1px solid ${T.green}30`, borderRadius: 14, padding: '16px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>✅</div>
      <div style={{ fontWeight: 700, color: T.green, fontSize: '0.88rem' }}>Acción completada</div>
      <button onClick={() => { setStep('idle'); setAction(null); }} style={{
        marginTop: 10, background: 'none', border: 'none', color: T.muted,
        fontSize: '0.78rem', cursor: 'pointer', fontFamily: font,
      }}>Otra acción</button>
    </div>
  );

  if (step === 'preview') return (
    <div style={{ background: '#F8F9FC', borderRadius: 14, padding: '16px', border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Vista previa del mensaje
      </div>
      <div style={{
        background: '#fff', borderRadius: 10, padding: '12px 14px',
        fontSize: '0.84rem', color: T.ink, lineHeight: 1.6,
        border: `1px solid ${T.border}`, marginBottom: 12,
      }}>
        {MESSAGES[action]}
      </div>
      {!hasPhone && (
        <div style={{ fontSize: '0.75rem', color: T.amber, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          ⚠ Sin teléfono registrado — copia el mensaje manualmente
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {hasPhone && (
          <a
            href={`https://wa.me/${feedback.contact_phone.replace(/\D/g, '')}?text=${encodeURIComponent(MESSAGES[action])}`}
            target="_blank" rel="noreferrer"
            onClick={handleConfirm}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 14px', borderRadius: 10, background: '#25D366', color: '#fff',
              fontWeight: 700, fontSize: '0.83rem', textDecoration: 'none', fontFamily: font,
            }}>
            <span>WhatsApp</span> →
          </a>
        )}
        <button onClick={handleCopy} style={{
          flex: 1, padding: '10px 14px', borderRadius: 10,
          border: `1.5px solid ${T.border}`, background: '#fff',
          fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer',
          color: copied ? T.green : T.ink, fontFamily: font,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {copied ? '✓ Copiado' : 'Copiar mensaje'}
        </button>
        {!hasPhone && (
          <button onClick={handleConfirm} disabled={saving} style={{
            flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none',
            background: saving ? T.muted : T.ink, color: '#fff',
            fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', fontFamily: font,
          }}>
            {saving ? 'Guardando…' : 'Marcar enviado'}
          </button>
        )}
        <button onClick={() => setStep('idle')} style={{
          padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.border}`,
          background: 'none', color: T.muted, cursor: 'pointer', fontFamily: font, fontSize: '0.83rem',
        }}>✕</button>
      </div>
    </div>
  );

  // idle
  return (
    <div>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Acciones
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ACTIONS.map(({ key, label, color, icon, disabled }) => (
          <button key={key} onClick={() => !disabled && handleSelect(key)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: 12,
            border: `1.5px solid ${disabled ? T.border : color + '40'}`,
            background: disabled ? '#FAFAFA' : color + '08',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: font, textAlign: 'left', opacity: disabled ? 0.5 : 1,
            transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: '1.1rem' }}>{icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: disabled ? T.muted : color }}>
                {label}
              </div>
              {disabled && (
                <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 1 }}>Ya realizado</div>
              )}
            </div>
            {!disabled && <ChevronRight size={14} color={color} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function FeedbackDrawer({ feedback, locations, onClose, tenant, onUpdate }) {
  if (!feedback) return null;
  const loc = locations.find(l => l.id === feedback.location_id);
  const nps = NPS_CATEGORY(feedback.score);
  const scoreColor = SCORE_COLOR[feedback.score] || T.muted;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)',
        zIndex: 200, backdropFilter: 'blur(2px)',
      }} />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: T.card, zIndex: 201, boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', fontFamily: font,
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquare size={16} color={T.coral} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: T.ink }}>Detalle del feedback</span>
          </div>
          <button onClick={onClose} style={{
            background: '#F1F5F9', border: 'none', borderRadius: 8,
            width: 32, height: 32, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', color: T.muted,
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* Score + NPS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: scoreColor + '15',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.8rem', fontWeight: 800, color: scoreColor, fontFamily: font,
            }}>
              {feedback.score}
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: T.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Calificación</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ScoreBadge score={feedback.score} />
                <span style={{
                  fontSize: '0.75rem', fontWeight: 700, color: nps.color,
                  background: nps.color + '12', borderRadius: 6, padding: '3px 8px',
                }}>{nps.label}</span>
              </div>
            </div>
          </div>

          {/* Info rows */}
          {[
            { label: 'Fecha y hora', value: format(new Date(feedback.created_at), "dd 'de' MMMM yyyy · HH:mm 'hrs'", { locale: es }) },
            { label: 'Sucursal', value: loc?.name || '—' },
            { label: 'QR', value: feedback.qr_codes?.label ? `${feedback.qr_codes.label} (${feedback.qr_codes.type})` : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: '0.88rem', color: T.ink, fontWeight: 500 }}>{value}</div>
            </div>
          ))}

          {/* Comment */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Comentario</div>
            <div style={{
              background: '#F8F9FC', borderRadius: 12, padding: '14px 16px',
              fontSize: '0.88rem', color: feedback.comment ? T.ink : T.muted,
              fontStyle: feedback.comment ? 'normal' : 'italic', lineHeight: 1.6,
            }}>
              {feedback.comment || 'Sin comentario'}
            </div>
          </div>

          {/* Follow-up */}
          {feedback.followup_answer && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Seguimiento</div>
              <div style={{
                background: T.purple + '08', borderRadius: 12, padding: '14px 16px',
                fontSize: '0.88rem', color: T.ink, lineHeight: 1.6,
                border: `1px solid ${T.purple}20`,
              }}>
                {Array.isArray(feedback.followup_answer) ? feedback.followup_answer.join(', ') : feedback.followup_answer}
              </div>
            </div>
          )}

          {/* Contact */}
          {(feedback.contact_phone || feedback.contact_email) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Contacto</div>
              <div style={{
                background: T.teal + '08', border: `1px solid ${T.teal}20`,
                borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                {feedback.contact_phone && (
                  <span style={{ fontSize: '0.88rem', color: T.teal, fontWeight: 700 }}>📱 {feedback.contact_phone}</span>
                )}
                {feedback.contact_email && (
                  <span style={{ fontSize: '0.88rem', color: T.teal, fontWeight: 700 }}>✉️ {feedback.contact_email}</span>
                )}
              </div>
            </div>
          )}

          {/* Status badges */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 10, background: feedback.routed_to_google ? T.teal + '10' : '#F1F5F9',
              border: `1px solid ${feedback.routed_to_google ? T.teal + '30' : T.border}`,
            }}>
              {feedback.routed_to_google
                ? <CheckCircle2 size={14} color={T.teal} />
                : <Minus size={14} color={T.muted} />}
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: feedback.routed_to_google ? T.teal : T.muted }}>
                {feedback.routed_to_google ? 'Enviado a Google' : 'Sin reseña Google'}
              </span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 10, background: feedback.recovery_sent ? T.coral + '10' : '#F1F5F9',
              border: `1px solid ${feedback.recovery_sent ? T.coral + '30' : T.border}`,
            }}>
              <Zap size={14} color={feedback.recovery_sent ? T.coral : T.muted} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: feedback.recovery_sent ? T.coral : T.muted }}>
                {feedback.recovery_sent ? 'Recovery enviado' : 'Sin recovery'}
              </span>
            </div>
          </div>

          {/* Coupon */}
          {feedback.coupon_code && (
            <div style={{
              marginTop: 16, background: `linear-gradient(135deg, ${T.coral}10, ${T.purple}10)`,
              border: `1px dashed ${T.coral}40`, borderRadius: 12, padding: '14px 16px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Cupón generado</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: T.coral, letterSpacing: '0.1em' }}>{feedback.coupon_code}</div>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: T.border, margin: '20px 0' }} />

          {/* Actions */}
          <ActionPanel feedback={feedback} tenant={tenant} onUpdate={onUpdate} />
        </div>
      </div>
    </>
  );
}

// ─── Feedback Table ────────────────────────────────────────────────────────────
function FeedbackTable({ rows, locations, loading, tenant, onUpdate }) {
  const [selected, setSelected] = useState(null);

  const handleUpdate = (updated) => {
    setSelected(updated);
    if (onUpdate) onUpdate(updated);
  };

  return (
    <>
      <FeedbackDrawer feedback={selected} locations={locations} onClose={() => setSelected(null)} tenant={tenant} onUpdate={handleUpdate} />
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
          }}>click para ver detalle</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#FAFAFA' }}>
                {['Fecha', 'Sucursal', 'Calificación', 'Google', 'Recovery', 'Seguimiento', 'Comentario'].map(h => (
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
                    {[...Array(7)].map((_, j) => (
                      <td key={j} style={{ padding: '14px 16px' }}>
                        <div style={{
                          height: 14, background: '#F1F5F9', borderRadius: 6,
                          width: j === 6 ? '80%' : '60%',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center' }}>
                    <MessageSquare size={32} color="#E5E7EB" style={{ marginBottom: 12 }} />
                    <div style={{ color: T.muted, fontSize: '0.88rem', fontWeight: 500 }}>
                      Aún no hay feedbacks. Escanea un QR para empezar.
                    </div>
                  </td>
                </tr>
              ) : rows.map((r, idx) => {
                const loc = locations.find(l => l.id === r.location_id);
                return (
                  <tr key={r.id} onClick={async () => {
                    setSelected(r);
                    const { data: fresh } = await supabase.from('feedbacks').select('*, qr_codes(label, type)').eq('id', r.id).single();
                    if (fresh) setSelected(fresh);
                  }} style={{
                    borderBottom: `1px solid ${T.border}`,
                    background: selected?.id === r.id ? T.coral + '06' : idx % 2 === 0 ? '#fff' : '#FAFAFA',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = T.coral + '06'}
                  onMouseLeave={e => e.currentTarget.style.background = selected?.id === r.id ? T.coral + '06' : idx % 2 === 0 ? '#fff' : '#FAFAFA'}
                  >
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
                      padding: '12px 16px', maxWidth: 160,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.followup_answer ? (
                        <span style={{
                          fontSize: '0.78rem', fontWeight: 600, color: T.coral,
                          background: T.coral + '10', borderRadius: 6, padding: '3px 8px',
                        }}>
                          {r.followup_answer}
                        </span>
                      ) : (
                        <Minus size={16} color="#D1D5DB" />
                      )}
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
    </>
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

// ─── Location Multiselect ─────────────────────────────────────────────────────
function LocationFilter({ locations, selected, onChange }) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState('');
  const ref                   = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));
  const allSelected = selected.length === 0;
  const label = allSelected
    ? 'Todas las sucursales'
    : selected.length === 1
      ? locations.find(l => l.id === selected[0])?.name || '1 sucursal'
      : `${selected.length} sucursales`;

  const toggle = id => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: 12, border: `1.5px solid ${selected.length ? T.coral : T.border}`,
        background: selected.length ? T.coral + '08' : T.card,
        cursor: 'pointer', fontFamily: font, fontWeight: 600,
        fontSize: '0.83rem', color: selected.length ? T.coral : T.ink,
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}>
        <MapPin size={14} color={selected.length ? T.coral : T.muted} />
        {label}
        {selected.length > 0 && (
          <span onClick={e => { e.stopPropagation(); onChange([]); }} style={{
            display: 'flex', alignItems: 'center', marginLeft: 2,
            color: T.coral, cursor: 'pointer',
          }}>
            <X size={13} />
          </span>
        )}
        <ChevronDown size={14} color={T.muted} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
          background: T.card, borderRadius: 16, border: `1px solid ${T.border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', width: 260,
          overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={14} color={T.muted} />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar sucursal…"
              style={{
                border: 'none', outline: 'none', fontFamily: font,
                fontSize: '0.83rem', color: T.ink, background: 'transparent', width: '100%',
              }}
            />
          </div>
          {/* "Todas" option */}
          <div onClick={() => { onChange([]); setOpen(false); }} style={{
            padding: '9px 14px', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 700,
            color: allSelected ? T.coral : T.muted,
            background: allSelected ? T.coral + '08' : 'transparent',
            borderBottom: `1px solid ${T.border}`,
          }}>
            Todas las sucursales
          </div>
          {/* List */}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.map(loc => {
              const checked = selected.includes(loc.id);
              return (
                <div key={loc.id} onClick={() => toggle(loc.id)} style={{
                  padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  background: checked ? T.coral + '06' : 'transparent',
                  transition: 'background 0.1s',
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 5, flexShrink: 0,
                    border: `2px solid ${checked ? T.coral : T.border}`,
                    background: checked ? T.coral : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {checked && <CheckCircle2 size={10} color="#fff" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: '0.83rem', color: T.ink, fontWeight: checked ? 600 : 400 }}>{loc.name}</span>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: T.muted, fontSize: '0.82rem' }}>Sin resultados</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_LOCATIONS = [
  { id: 'demo-loc-1', name: 'Sucursal Centro' },
  { id: 'demo-loc-2', name: 'Sucursal Norte' },
  { id: 'demo-loc-3', name: 'Sucursal Sur' },
];
function makeDemoFeedbacks() {
  const comments = [
    'Excelente atención, volveré pronto',
    'El servicio fue muy rápido',
    'Me encantó la atención del personal',
    'Todo perfecto, muy limpio',
    'Buen servicio pero tardaron un poco',
    'El producto llegó en buen estado',
    'Esperé demasiado tiempo',
    'Personal amable y servicial',
    'Precios accesibles',
    'Instalaciones muy limpias',
  ];
  const now = Date.now();
  return Array.from({ length: 80 }, (_, i) => {
    const score = [5,5,5,5,4,4,4,3,2,1][i % 10];
    const loc = DEMO_LOCATIONS[i % 3];
    return {
      id: `demo-fb-${i}`,
      score,
      location_id: loc.id,
      routed_to_google: score === 5 && i % 3 !== 0,
      recovery_sent: score <= 2 && i % 2 === 0,
      comment: score >= 4 ? comments[i % comments.length] : null,
      created_at: new Date(now - i * 8 * 3600000).toISOString(),
      qr_codes: { label: loc.name, type: 'table' },
    };
  });
}

export default function RetelioDashboard() {
  const { tenant } = useTenant();
  const [feedbacks,      setFeedbacks]      = useState([]);
  const [locations,      setLocations]      = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [range,          setRange]          = useState(30);
  const [selectedLocs,   setSelectedLocs]   = useState([]);
  const [healthFilter,   setHealthFilter]   = useState('all');
  const [demoMode,       setDemoMode]       = useState(() => localStorage.getItem('retelio_demo') === 'true');

  const toggleDemo = () => {
    const next = !demoMode;
    setDemoMode(next);
    localStorage.setItem('retelio_demo', next ? 'true' : 'false');
  };

  const loadData = async (withDemo = false) => {
    if (!tenant?.id) return;
    setLoading(true);
    const since = subDays(new Date(), range).toISOString();
    const [fbRes, locRes] = await Promise.all([
      supabase
        .from('feedbacks')
        .select('*, qr_codes(label, type)')
        .eq('tenant_id', tenant.id)
        .eq('is_test', tenant?.test_mode ? true : false)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('locations')
        .select('id, name')
        .eq('tenant_id', tenant.id),
    ]);
    const realFeedbacks = fbRes.data || [];
    const realLocations = locRes.data || [];
    if (withDemo) {
      setFeedbacks([...makeDemoFeedbacks(), ...realFeedbacks]);
      setLocations([...DEMO_LOCATIONS, ...realLocations]);
    } else {
      setFeedbacks(realFeedbacks);
      setLocations(realLocations);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (tenant?.id) loadData(demoMode);
  }, [tenant?.id, range, demoMode]);

  // ── Filtered locations based on health filter ──
  const filteredLocIds = useMemo(() => {
    let locs = locations;
    if (selectedLocs.length > 0)
      locs = locs.filter(l => selectedLocs.includes(l.id));
    if (healthFilter !== 'all') {
      locs = locs.filter(loc => {
        const fbs = feedbacks.filter(f => f.location_id === loc.id);
        if (fbs.length === 0) return false;
        const avg = fbs.reduce((s, f) => s + f.score, 0) / fbs.length;
        return healthFilter === 'risk' ? avg < 3.0 : avg >= 4.3;
      });
    }
    return new Set(locs.map(l => l.id));
  }, [locations, feedbacks, selectedLocs, healthFilter]);

  const filteredFeedbacks = useMemo(() => {
    const noLocFilter  = selectedLocs.length === 0;
    const noHealthFilter = healthFilter === 'all';
    if (noLocFilter && noHealthFilter) return feedbacks;
    return feedbacks.filter(f => filteredLocIds.has(f.location_id));
  }, [feedbacks, filteredLocIds, selectedLocs, healthFilter]);

  const filteredLocations = useMemo(() => (
    locations.filter(l => filteredLocIds.has(l.id))
  ), [locations, filteredLocIds]);

  const metrics = useMemo(() => {
    const total     = filteredFeedbacks.length;
    const reviews   = filteredFeedbacks.filter(f => f.routed_to_google).length;
    const unhappy   = filteredFeedbacks.filter(f => f.score <= 2).length;
    const recovered = filteredFeedbacks.filter(f => f.recovery_sent).length;
    const avgScore  = total
      ? (filteredFeedbacks.reduce((s, f) => s + (f.score ?? f.satisfaccion ?? 0), 0) / total).toFixed(1)
      : '—';
    const recRate = unhappy ? Math.round((recovered / unhappy) * 100) : 0;
    // NPS adaptativo (1-5 ó 0-10)
    const maxScoreDetected = Math.max(...filteredFeedbacks.map(f => f.score ?? 0));
    const isNPSStandard    = maxScoreDetected > 5;

    const promoters = filteredFeedbacks.filter(f => {
      const s = f.score ?? 0;
      return isNPSStandard ? s >= 9 : s === 5;
    }).length;

    const detractors = filteredFeedbacks.filter(f => {
      const s = f.score ?? 0;
      return isNPSStandard ? s <= 6 : s <= 2;
    }).length;

    const passives = total - promoters - detractors;
    const nps = total
      ? Math.round((promoters / total - detractors / total) * 100)
      : null;
    const npsBreakdown = total ? {
      promotersPct:  Math.round((promoters  / total) * 100),
      passivesPct:   Math.round((passives   / total) * 100),
      detractorsPct: Math.round((detractors / total) * 100),
    } : null;
    return { total, reviews, unhappy, recovered, avgScore, recRate, nps, npsBreakdown };
  }, [filteredFeedbacks]);

  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), range - 1), end: new Date() });
    return days.map(day => {
      const label  = format(day, 'd MMM', { locale: es });
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayFbs = filteredFeedbacks.filter(f => f.created_at.startsWith(dayStr));
      return {
        date:      label,
        Feedbacks: dayFbs.length,
        Reseñas:   dayFbs.filter(f => f.routed_to_google).length,
      };
    });
  }, [filteredFeedbacks, range]);

  const scoreData = useMemo(() => (
    [1, 2, 3, 4, 5].map(s => ({
      score: `${s}★`,
      count: filteredFeedbacks.filter(f => f.score === s).length,
    }))
  ), [filteredFeedbacks]);

  const SCORE_COLORS = [T.red, '#FB923C', T.amber, T.teal, T.green];

  const plan       = tenant?.plan || 'free';
  const isTrial    = isActiveTrial(tenant);
  const planLimits = getPlanLimits(plan);
  const pct        = isTrial ? 0 : limitPct(metrics.reviews, planLimits.maxReviewsPerMonth);

  const tickInterval = range <= 7 ? 0 : range <= 30
    ? Math.floor(chartData.length / 6)
    : Math.floor(chartData.length / 8);

  return (
    <div style={{ fontFamily: font, padding: '28px', background: T.bg, minHeight: '100vh' }}>

      {/* ── Test mode banner ── */}
      {tenant?.test_mode && !demoMode && (
        <div style={{
          background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 12,
          padding: '10px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1rem' }}>🧪</span>
          <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#1E40AF', flex: 1 }}>
            Modo prueba activo — los QRs y el feedback generado son de prueba. Cuando estés listo, ve a <strong>Configuración → Salir a producción</strong>.
          </span>
        </div>
      )}

      {/* ── Demo banner ── */}
      {demoMode && (
        <div style={{
          background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 12,
          padding: '10px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1rem' }}>🎭</span>
            <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#92400E' }}>
              Modo demo activo — estás viendo datos de ejemplo, no son reales.
            </span>
          </div>
          <button onClick={toggleDemo} style={{
            background: '#92400E', color: '#fff', border: 'none', borderRadius: 8,
            padding: '5px 14px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: font,
          }}>
            Salir del demo
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: '0.85rem', color: T.muted, fontWeight: 500 }}>
            {demoMode ? 'Datos de ejemplo' : (tenant?.name || 'Tu negocio')} · últimos {range} días
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!demoMode && (
            <button onClick={toggleDemo} style={{
              background: 'white', color: T.muted, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: '6px 14px', fontSize: '0.78rem',
              fontWeight: 700, cursor: 'pointer', fontFamily: font,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              🎭 Ver demo
            </button>
          )}
          <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 12, padding: 4 }}>
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
      </div>

      {/* ── Filters ── */}
      {locations.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
          flexWrap: 'wrap',
        }}>
          <LocationFilter
            locations={locations}
            selected={selectedLocs}
            onChange={setSelectedLocs}
          />

          {/* Health filter pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'all',  label: 'Todas' },
              { key: 'risk', label: '⚠ En riesgo' },
              { key: 'top',  label: '⭐ Destacadas' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setHealthFilter(key)} style={{
                padding: '8px 14px', borderRadius: 12, border: `1.5px solid ${healthFilter === key ? T.coral : T.border}`,
                background: healthFilter === key ? T.coral + '08' : T.card,
                color: healthFilter === key ? T.coral : T.muted,
                fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer',
                fontFamily: font, transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>

          {/* Active filter summary */}
          {(selectedLocs.length > 0 || healthFilter !== 'all') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.78rem', color: T.muted, fontWeight: 500 }}>
                {filteredLocIds.size} de {locations.length} sucursales
              </span>
              <button onClick={() => { setSelectedLocs([]); setHealthFilter('all'); }} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff',
                color: T.muted, fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: font,
              }}>
                <X size={11} /> Limpiar
              </button>
            </div>
          )}
        </div>
      )}


      {/* ── Metric cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 20 }}>
        <NPSCard
          nps={loading ? null : metrics.nps}
          breakdown={metrics.npsBreakdown}
          loading={loading}
          range={range}
        />
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
          sub={`${metrics.reviews} este mes`}
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
          isTrial={isTrial}
          loading={loading}
        />
      </div>

      {/* ── Location breakdown ── */}
      <LocationBreakdown feedbacks={filteredFeedbacks} locations={filteredLocations.length ? filteredLocations : locations} loading={loading} />

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
      <InsightsCard insights={generateInsights(filteredFeedbacks, filteredLocations.length ? filteredLocations : locations)} loading={loading} />

      {/* ── Feedback table ── */}
      <FeedbackTable
        rows={filteredFeedbacks.slice(0, 50)}
        locations={locations}
        loading={loading}
        tenant={tenant}
        onUpdate={updated => setFeedbacks(prev => prev.map(f => f.id === updated.id ? updated : f))}
      />

    </div>
  );
}
