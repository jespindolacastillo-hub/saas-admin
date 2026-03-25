import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import {
  CheckCircle2, Loader, RefreshCw, ChevronDown, ChevronUp,
  MessageSquare, Phone, Edit2, Tag,
} from 'lucide-react';
import { subHours, subDays, startOfMonth, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const T = {
  coral:'#FF5C3A', teal:'#00C9A7', purple:'#7C3AED', ink:'#0D0D12',
  muted:'#6B7280', border:'#E5E7EB', bg:'#F7F8FC', card:'#FFFFFF',
  green:'#16A34A', amber:'#F59E0B', red:'#DC2626',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const genCode = (prefix = 'MANUAL') => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${code}`;
};

function buildMessage(fb, locationName) {
  const name = locationName || 'nuestro negocio';
  if (fb.comment) {
    const q = fb.comment.length > 70 ? fb.comment.slice(0, 70) + '…' : fb.comment;
    return `Hola, somos ${name}. Vimos tu visita de hoy y notaste que "${q}" 😔 Queremos resolverlo personalmente. ¿Tienes un momento?`;
  }
  if (fb.followup_answer) {
    return `Hola, somos ${name}. Notamos que tuviste un problema con ${fb.followup_answer.toLowerCase()} en tu visita de hoy 😔 Queremos compensarte. ¿Tienes un momento?`;
  }
  return `Hola, somos ${name}. Notamos que tu experiencia de hoy no fue la que mereces 😔 Queremos hacer algo para resolverlo. ¿Tienes un momento?`;
}

function Timer({ createdAt }) {
  const calc = () => Math.max(0, 120 - Math.floor((Date.now() - new Date(createdAt)) / 60000));
  const [mins, setMins] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setMins(calc()), 30000);
    return () => clearInterval(t);
  }, [createdAt]);
  if (mins === 0) return <span style={{ fontSize: '0.7rem', color: T.red, fontWeight: 700 }}>Ventana cerrada</span>;
  const label = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  return <span style={{ fontSize: '0.7rem', fontWeight: 700, color: mins < 30 ? T.red : T.amber }}>⏰ {label}</span>;
}

// ─── Urgency panel (Bain & Co) ────────────────────────────────────────────────
function UrgencyPanel({ hot, warm, cold, activeFilter, onFilter }) {
  const stages = [
    { key: 'hot',  label: 'Actuar ahora', window: '< 2 horas',    pct: 70, color: T.red,   dot: '🔴', count: hot  },
    { key: 'warm', label: 'Actuar hoy',   window: '2 – 24 horas', pct: 30, color: T.amber, dot: '🟡', count: warm },
    { key: 'cold', label: 'Tarde',        window: '> 24 horas',   pct: 15, color: T.muted, dot: '⚪', count: cold },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
      {stages.map(s => {
        const active = activeFilter === s.key;
        return (
          <button key={s.key} onClick={() => onFilter(active ? null : s.key)} style={{
            background: active ? s.color + '10' : T.card,
            border: `1.5px solid ${active ? s.color : T.border}`,
            borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
            textAlign: 'left', fontFamily: font, transition: 'all .15s',
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
              {s.dot} {s.label}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: T.ink, lineHeight: 1, marginBottom: 2 }}>
              {s.count}
            </div>
            <div style={{ fontSize: '0.7rem', color: T.muted, marginBottom: 10 }}>{s.window}</div>
            <div style={{ height: 4, background: T.border, borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 99 }} />
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: s.color }}>{s.pct}% prob. de recuperar</div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────
function TableRow({ fb, locationName, qrLabel, bucket, userEmail, coupons, onUpdate, isEscalated }) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);

  const contacted = fb.recovery_status === 'contacted' || fb.recovery_status === 'resolved';
  const resolved  = fb.recovery_status === 'resolved' || fb.coupon_redeemed;
  const scoreColor = fb.score <= 1 ? T.red : T.coral;

  const borderColor = resolved ? T.teal : bucket === 'hot' ? T.red : bucket === 'warm' ? T.amber : T.muted;

  const handleWhatsApp = async () => {
    const msg = encodeURIComponent(buildMessage(fb, locationName));
    window.open(`https://wa.me/52${fb.contact_phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
    if (contacted) return;
    setSaving(true);
    const now = new Date().toISOString();
    const u = { recovery_status: 'contacted', recovery_at: now, recovery_actor: userEmail };
    await supabase.from('feedbacks').update(u).eq('id', fb.id);
    onUpdate({ ...fb, ...u });
    setSaving(false);
  };

  const handleResolved = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const u = { recovery_status: 'resolved', recovery_resolved_at: now };
    await supabase.from('feedbacks').update(u).eq('id', fb.id);
    onUpdate({ ...fb, ...u });
    setSaving(false);
  };

  const handleAssignCoupon = async (cfg) => {
    setSaving(true);
    setCouponOpen(false);
    const code = genCode(cfg.coupon_prefix || 'MANUAL');
    const upd = { coupon_code: code, coupon_config_id: cfg.id, recovery_sent: true };
    await supabase.from('feedbacks').update(upd).eq('id', fb.id);
    onUpdate({ ...fb, ...upd });
    setSaving(false);
  };

  const urgencyBadge = resolved
    ? <span style={badge(T.teal)}>✓ Recuperado</span>
    : contacted
    ? <span style={badge(T.teal)}>Contactado</span>
    : bucket === 'hot'
    ? <Timer createdAt={fb.created_at} />
    : bucket === 'warm'
    ? <span style={{ fontSize: '0.7rem', color: T.amber, fontWeight: 700 }}>Hoy</span>
    : <span style={{ fontSize: '0.7rem', color: T.muted, fontWeight: 600 }}>
        {formatDistanceToNow(new Date(fb.created_at), { locale: es, addSuffix: true })}
      </span>;

  return (
    <>
      <tr
        onClick={() => setExpanded(e => !e)}
        style={{
          borderLeft: `3px solid ${isEscalated ? T.red : borderColor}`,
          cursor: 'pointer',
          background: expanded ? T.bg : resolved ? '#F0FDF4' : isEscalated ? '#FFF5F5' : T.card,
          opacity: resolved ? 0.75 : 1,
          transition: 'background .1s',
          animation: isEscalated ? 'escalate-pulse 2s ease-in-out infinite' : 'none',
        }}
      >
        {/* Score */}
        <td style={td}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: scoreColor + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: scoreColor, fontSize: '0.88rem' }}>
            {fb.score}★
          </div>
        </td>

        {/* Location + area + time */}
        <td style={td}>
          <div style={{ fontWeight: 700, color: T.ink, fontSize: '0.82rem' }}>{locationName || '—'}</div>
          {qrLabel && (
            <div style={{ fontSize: '0.7rem', color: T.purple, fontWeight: 600, marginTop: 1 }}>📍 {qrLabel}</div>
          )}
          <div style={{ fontSize: '0.7rem', color: T.muted, marginTop: 1 }}>
            {formatDistanceToNow(new Date(fb.created_at), { locale: es, addSuffix: true })}
          </div>
        </td>

        {/* Reason */}
        <td style={td}>
          {fb.followup_answer && (
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: T.coral }}>{fb.followup_answer}</span>
          )}
          {fb.comment && (
            <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 2, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              "{fb.comment}"
            </div>
          )}
          {!fb.followup_answer && !fb.comment && <span style={{ fontSize: '0.72rem', color: T.muted }}>—</span>}
        </td>

        {/* Phone */}
        <td style={td}>
          {fb.contact_phone
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Phone size={11} color="#25D366" />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: T.green }}>{fb.contact_phone}</span>
              </div>
            : <span style={{ fontSize: '0.72rem', color: T.border }}>Sin teléfono</span>
          }
          {fb.coupon_code && (
            <div style={{ fontSize: '0.65rem', color: T.purple, fontWeight: 700, marginTop: 2 }}>🎟 {fb.coupon_code}</div>
          )}
        </td>

        {/* Urgency */}
        <td style={{ ...td, whiteSpace: 'nowrap' }}>{urgencyBadge}</td>

        {/* Actions */}
        <td style={{ ...td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
            {fb.contact_phone && !resolved && (
              <button onClick={handleWhatsApp} disabled={saving} title="Abrir WhatsApp" style={{
                padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: contacted ? '#25D36615' : '#25D366',
                color: contacted ? '#16A34A' : '#fff',
                fontFamily: font, fontSize: '0.75rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {saving ? <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <MessageSquare size={11} />}
                WA
              </button>
            )}
            {contacted && !resolved && (
              <button onClick={handleResolved} disabled={saving} title="Marcar recuperado" style={{
                padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: T.teal, color: '#fff', fontFamily: font, fontSize: '0.75rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <CheckCircle2 size={11} /> ✓
              </button>
            )}
            <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, display: 'flex', padding: 4 }}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr style={{ background: T.bg }}>
          <td colSpan={6} style={{ padding: '12px 16px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>

              {/* Message preview */}
              <div>
                {(fb.comment || fb.followup_answer || qrLabel) && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
                      Comentario del cliente
                    </div>
                    <div style={{ fontSize: '0.88rem', color: T.ink, lineHeight: 1.6, background: T.card, borderRadius: 10, padding: '10px 12px', border: `1px solid ${T.border}` }}>
                      {qrLabel && (
                        <div style={{ fontSize: '0.72rem', color: T.purple, fontWeight: 700, marginBottom: fb.followup_answer || fb.comment ? 6 : 0 }}>
                          📍 {locationName} · {qrLabel}
                        </div>
                      )}
                      {fb.followup_answer && (
                        <span style={{ fontWeight: 700, color: T.coral }}>{fb.followup_answer}{fb.comment ? ' · ' : ''}</span>
                      )}
                      {fb.comment && `"${fb.comment}"`}
                    </div>
                  </div>
                )}
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
                  Mensaje pre-llenado para WhatsApp
                </div>
                <div style={{ fontSize: '0.82rem', color: T.ink, lineHeight: 1.6, background: T.card, borderRadius: 10, padding: '10px 12px', border: `1px solid ${T.border}`, fontStyle: 'italic' }}>
                  "{buildMessage(fb, locationName)}"
                </div>
              </div>

              {/* Coupon assignment */}
              <div style={{ minWidth: 180 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
                  Cupón
                </div>
                {fb.coupon_code ? (
                  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.68rem', color: T.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Asignado</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1rem', color: T.ink }}>{fb.coupon_code}</div>
                  </div>
                ) : coupons.length > 0 ? (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setCouponOpen(o => !o)}
                      disabled={saving || resolved}
                      style={{
                        padding: '8px 12px', borderRadius: 10, border: `1.5px dashed ${T.border}`,
                        background: T.card, cursor: 'pointer', fontFamily: font,
                        fontSize: '0.78rem', fontWeight: 600, color: T.muted,
                        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                      }}
                    >
                      <Tag size={12} /> Asignar cupón ▾
                    </button>
                    {couponOpen && (
                      <div style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 20,
                        background: T.card, border: `1.5px solid ${T.border}`, borderRadius: 12,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, overflow: 'hidden',
                      }}>
                        {coupons.map((cfg, i) => (
                          <button key={i} onClick={() => handleAssignCoupon(cfg)} style={{
                            width: '100%', padding: '10px 14px', border: 'none', background: 'none',
                            cursor: 'pointer', textAlign: 'left', fontFamily: font,
                            borderBottom: i < coupons.length - 1 ? `1px solid ${T.border}` : 'none',
                          }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: T.ink }}>{cfg.offer_description || cfg.coupon_prefix}</div>
                            <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: 2 }}>
                              Válido {cfg.validity_days || 30} días · prefijo {cfg.coupon_prefix || 'MANUAL'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: T.muted, fontStyle: 'italic' }}>Sin cupones configurados</div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const td = {
  padding: '12px 14px',
  verticalAlign: 'middle',
  borderBottom: `1px solid ${T.border}`,
  fontSize: '0.82rem',
  color: T.ink,
};

const badge = (color) => ({
  fontSize: '0.65rem', fontWeight: 700, color, background: color + '15',
  padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
  display: 'inline-block',
});

// ─── Hero metric ──────────────────────────────────────────────────────────────
function Hero({ feedbacks, avgTicket, onEditTicket }) {
  const monthStart = startOfMonth(new Date()).toISOString();
  const badThisMonth      = feedbacks.filter(f => f.created_at > monthStart);
  const recoveredThisMonth = badThisMonth.filter(f => f.recovery_status === 'resolved' || f.coupon_redeemed);
  const withPhone = badThisMonth.filter(f => f.contact_phone);
  const rate    = withPhone.length > 0 ? Math.round(recoveredThisMonth.length / withPhone.length * 100) : 0;
  const revenue = recoveredThisMonth.length * avgTicket;

  return (
    <div style={{ background: T.card, borderRadius: 18, padding: '20px 24px', border: `1px solid ${T.border}`, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>💰 Revenue recuperado este mes</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em' }}>${revenue.toLocaleString('es-MX')}</div>
          <div style={{ fontSize: '0.78rem', color: T.muted, marginTop: 2 }}>{recoveredThisMonth.length} de {withPhone.length} clientes con teléfono</div>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted }}>Tasa de recuperación</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: rate >= 60 ? T.teal : rate >= 30 ? T.amber : T.red }}>{rate}%</span>
          </div>
          <div style={{ height: 8, background: T.border, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${rate}%`, background: rate >= 60 ? T.teal : rate >= 30 ? T.amber : T.red, borderRadius: 99, transition: 'width .6s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <span style={{ fontSize: '0.72rem', color: T.muted }}><strong style={{ color: T.green }}>{recoveredThisMonth.length}</strong> recuperados</span>
            <span style={{ fontSize: '0.72rem', color: T.muted }}><strong style={{ color: T.amber }}>{withPhone.length - recoveredThisMonth.length}</strong> pendientes</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.72rem', color: T.muted }}>Ticket promedio:</span>
          <button onClick={onEditTicket} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: font, fontSize: '0.78rem', fontWeight: 700, color: T.ink, display: 'flex', alignItems: 'center', gap: 4 }}>
            ${avgTicket} <Edit2 size={11} color={T.muted} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Validation tab ───────────────────────────────────────────────────────────
function ValidationTab({ feedbacks, locations, tenant, userEmail, onUpdate }) {
  const [saving, setSaving] = useState(null);

  const pending = feedbacks.filter(f =>
    f.coupon_code && !f.coupon_redeemed && !f.coupon_not_returned
  );

  const markRedeemed = async (fb) => {
    setSaving(fb.id);
    const now = new Date().toISOString();
    const u = { coupon_redeemed: true, coupon_redeemed_at: now, coupon_redeemed_by: userEmail, recovery_status: 'resolved', recovery_resolved_at: now };
    await supabase.from('feedbacks').update(u).eq('id', fb.id).eq('tenant_id', tenant.id);
    onUpdate({ ...fb, ...u });
    setSaving(null);
  };

  const markNotReturned = async (fb) => {
    setSaving(fb.id + '_no');
    await supabase.from('feedbacks').update({ coupon_not_returned: true }).eq('id', fb.id).eq('tenant_id', tenant.id);
    onUpdate({ ...fb, coupon_not_returned: true });
    setSaving(null);
  };

  if (pending.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
        <div style={{ fontWeight: 700, color: T.ink, marginBottom: 6 }}>¡Todo validado!</div>
        <div style={{ fontSize: '0.85rem', color: T.muted }}>No hay cupones pendientes de confirmar en caja.</div>
      </div>
    );
  }

  return (
    <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: T.bg }}>
            {['Cal.', 'Cupón', 'Sucursal · Teléfono', 'Estado', ''].map((h, i) => (
              <th key={i} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: `1px solid ${T.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pending.map(fb => {
            const loc = locations.find(l => l.id === fb.location_id);
            const scoreColor = fb.score <= 1 ? T.red : T.coral;
            return (
              <tr key={fb.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={td}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: scoreColor + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: scoreColor, fontSize: '0.82rem' }}>
                    {fb.score}★
                  </div>
                </td>
                <td style={td}>
                  <div style={{ fontFamily: 'monospace', fontWeight: 800, color: T.purple }}>{fb.coupon_code}</div>
                </td>
                <td style={td}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: T.ink }}>{loc?.name || '—'}</div>
                  {fb.contact_phone && <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 1 }}>📱 {fb.contact_phone}</div>}
                </td>
                <td style={td}>
                  {fb.coupon_redeemed
                    ? <span style={badge(T.green)}>Canjeado</span>
                    : fb.coupon_not_returned
                    ? <span style={badge(T.muted)}>No regresó</span>
                    : <span style={badge(T.amber)}>Pendiente</span>
                  }
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {!fb.coupon_redeemed && !fb.coupon_not_returned && (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => markRedeemed(fb)} disabled={!!saving} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: T.green, color: '#fff', fontFamily: font, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {saving === fb.id ? <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={11} />} Canjeó
                      </button>
                      <button onClick={() => markNotReturned(fb)} disabled={!!saving} style={{ padding: '7px 10px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: 'none', color: T.muted, fontFamily: font, fontSize: '0.78rem', cursor: 'pointer' }}>
                        {saving === fb.id + '_no' ? <Loader size={11} /> : '✗'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function IssueManagement() {
  const { tenant } = useTenant();
  const [feedbacks, setFeedbacks]       = useState([]);
  const [locations, setLocations]       = useState([]);
  const [qrLabels, setQrLabels]         = useState({});
  const [coupons, setCoupons]           = useState([]);
  const [escalationBanner, setEscalationBanner] = useState([]);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('queue');
  const [filter, setFilter]       = useState(null); // 'hot' | 'warm' | 'cold' | null
  const [avgTicket, setAvgTicket] = useState(() => Number(localStorage.getItem('retelio_avg_ticket') || 350));
  const [editingTicket, setEditingTicket] = useState(false);
  const [ticketInput, setTicketInput]     = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || ''));
  }, []);

  useEffect(() => {
    if (tenant?.id) loadData();
  }, [tenant?.id]);

  const loadData = async () => {
    setLoading(true);
    const since = subDays(new Date(), 30).toISOString();
    const [fbRes, locRes, locRes2, cpRes, qrRes] = await Promise.all([
      supabase.from('feedbacks')
        .select('id, location_id, qr_id, score, comment, followup_answer, contact_phone, created_at, recovery_status, recovery_at, recovery_actor, recovery_resolved_at, coupon_code, coupon_redeemed, coupon_redeemed_at, coupon_redeemed_by, coupon_not_returned, recovery_sent')
        .eq('tenant_id', tenant.id)
        .eq('is_test', tenant.test_mode === true)
        .lte('score', 2)
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      supabase.from('locations').select('id, name').eq('tenant_id', tenant.id),
      supabase.from('Tiendas_Catalogo').select('id, name:nombre').eq('tenant_id', tenant.id),
      supabase.from('recovery_config').select('*').eq('tenant_id', tenant.id),
      supabase.from('qr_codes').select('id, label').eq('tenant_id', tenant.id),
    ]);
    const allLocs = [...(locRes.data || []), ...(locRes2.data || [])];
    setLocations(Object.values(Object.fromEntries(allLocs.map(l => [l.id, l]))));
    const fbs = fbRes.data || [];
    setFeedbacks(fbs);
    setCoupons(cpRes.data || []);
    setQrLabels(Object.fromEntries((qrRes.data || []).filter(q => q.label).map(q => [q.id, q.label])));

    // ── Escalation check ──────────────────────────────────────────────────────
    const nowMs = Date.now();
    const toEscalate = fbs.filter(f => {
      if (!f.contact_phone) return false;
      if (f.recovery_status && f.recovery_status !== 'pending') return false;
      const ageMin = (nowMs - new Date(f.created_at)) / 60000;
      if (ageMin < 90 || ageMin > 120) return false; // 90–120 min window
      return !localStorage.getItem(`esc_${f.id}`);
    });
    if (toEscalate.length > 0) {
      const allLocs = [...(locRes.data || []), ...(locRes2.data || [])];
      const locsMap = Object.fromEntries(allLocs.map(l => [l.id, l]));
      toEscalate.forEach(f => {
        localStorage.setItem(`esc_${f.id}`, '1');
        const loc = locsMap[f.location_id];
        if (loc?.whatsapp_number) {
          const locName = loc.name || 'tu negocio';
          const msg = encodeURIComponent(
            `⚠️ Alerta Retelio: hay un cliente en ${locName} que lleva más de 90 minutos sin ser contactado (calificación ${f.score}★). Entra a retelio.app para actuar antes de que cierre la ventana de recuperación.`
          );
          supabase.functions.invoke('send-whatsapp-alert', {
            body: { tenant_id: tenant.id, location_id: f.location_id, score: f.score, whatsapp_number: loc.whatsapp_number, comment: `ESCALACIÓN — sin contactar hace 90+ min`, qr_label: 'Escalación automática' },
          }).catch(() => {});
        }
      });
      setEscalationBanner(toEscalate);
    }
    setLoading(false);
  };

  const updateFeedback = useCallback(updated => {
    setFeedbacks(prev => prev.map(f => f.id === updated.id ? updated : f));
  }, []);

  const saveTicket = () => {
    const val = parseInt(ticketInput);
    if (val > 0) { setAvgTicket(val); localStorage.setItem('retelio_avg_ticket', val); }
    setEditingTicket(false);
  };

  const now = new Date();

  // Bucket every feedback by age (regardless of phone — for urgency panel counts)
  const allPending = feedbacks.filter(f => !f.recovery_status || f.recovery_status === 'pending');
  const hotAll  = allPending.filter(f => new Date(f.created_at) > subHours(now, 2));
  const warmAll = allPending.filter(f => new Date(f.created_at) <= subHours(now, 2) && new Date(f.created_at) > subHours(now, 24));
  const coldAll = allPending.filter(f => new Date(f.created_at) <= subHours(now, 24));

  // Actionable queue (has phone) — used in table
  const hot     = hotAll.filter(f => f.contact_phone);
  const warm    = warmAll.filter(f => f.contact_phone);
  const cold    = coldAll.filter(f => f.contact_phone);
  const contacted = feedbacks.filter(f => f.recovery_status === 'contacted');
  const noPhone = allPending.filter(f => !f.contact_phone);

  const getBucket = (fb) => {
    if (new Date(fb.created_at) > subHours(now, 2)) return 'hot';
    if (new Date(fb.created_at) > subHours(now, 24)) return 'warm';
    return 'cold';
  };

  // Build filtered rows for table
  const queueRows = useMemo(() => {
    let rows = [...hot, ...warm, ...cold, ...contacted];
    if (filter === 'hot')  rows = rows.filter(f => new Date(f.created_at) > subHours(now, 2));
    if (filter === 'warm') rows = rows.filter(f => new Date(f.created_at) <= subHours(now, 2) && new Date(f.created_at) > subHours(now, 24));
    if (filter === 'cold') rows = rows.filter(f => new Date(f.created_at) <= subHours(now, 24));
    return rows;
  }, [feedbacks, filter]);

  const totalActionable = hot.length + warm.length;
  const pendingCoupons  = feedbacks.filter(f => f.coupon_code && !f.coupon_redeemed && !f.coupon_not_returned).length;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto', fontFamily: font }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: T.ink, marginBottom: 2 }}>Recuperación</h2>
          <p style={{ fontSize: '0.82rem', color: T.muted }}>
            {loading ? 'Cargando…' : totalActionable === 0 ? 'Sin clientes pendientes' : `${totalActionable} cliente${totalActionable !== 1 ? 's' : ''} por contactar`}
          </p>
        </div>
        <button onClick={loadData} disabled={loading} style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: font, fontSize: '0.8rem', fontWeight: 600, color: T.muted }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Actualizar
        </button>
      </div>

      {/* Escalation banner */}
      {escalationBanner.length > 0 && (
        <div style={{
          background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 14,
          padding: '14px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <button
            onClick={() => { setFilter('hot'); setTab('queue'); }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, flex: 1 }}
          >
            <span style={{ fontSize: '1.3rem' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 800, color: T.red, fontSize: '0.88rem' }}>
                {escalationBanner.length === 1
                  ? '1 cliente lleva más de 90 min sin ser contactado'
                  : `${escalationBanner.length} clientes llevan más de 90 min sin ser contactados`}
                {' '}<span style={{ fontWeight: 400, fontSize: '0.78rem', color: '#B91C1C' }}>→ Ver en tabla</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#B91C1C', marginTop: 2 }}>
                Se envió alerta al gerente. La ventana de recuperación cierra en menos de 30 min.
              </div>
              {escalationBanner.map(f => {
                const loc = locations.find(l => l.id === f.location_id);
                const mins = Math.floor((Date.now() - new Date(f.created_at)) / 60000);
                return (
                  <div key={f.id} style={{ marginTop: 6, fontSize: '0.75rem', color: '#991B1B', background: '#fee2e2', borderRadius: 8, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 6 }}>
                    <span style={{ fontWeight: 700 }}>{loc?.name || 'Sucursal'}</span>
                    {f.contact_phone && <span>· 📱 {f.contact_phone}</span>}
                    {f.followup_answer && <span>· {f.followup_answer}</span>}
                    <span style={{ fontWeight: 800 }}>· ⏰ {mins}m</span>
                  </div>
                );
              })}
            </div>
          </button>
          <button onClick={() => setEscalationBanner([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontSize: '1.1rem', padding: 4, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* Avg ticket modal */}
      {editingTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEditingTicket(false)}>
          <div style={{ background: T.card, borderRadius: 20, padding: '28px 32px', width: 300, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 800, color: T.ink, marginBottom: 8 }}>Ticket promedio</h3>
            <p style={{ fontSize: '0.82rem', color: T.muted, marginBottom: 16 }}>Para calcular revenue recuperado.</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: T.muted }}>$</span>
              <input autoFocus type="number" value={ticketInput} onChange={e => setTicketInput(e.target.value)}
                placeholder={String(avgTicket)} onKeyDown={e => e.key === 'Enter' && saveTicket()}
                style={{ flex: 1, border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 14px', fontFamily: font, fontSize: '1rem', outline: 'none' }} />
              <span style={{ fontSize: '0.8rem', color: T.muted }}>MXN</span>
            </div>
            <button onClick={saveTicket} style={{ width: '100%', marginTop: 14, padding: '12px', borderRadius: 12, border: 'none', background: T.coral, color: '#fff', fontFamily: font, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
              Guardar
            </button>
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* Hero */}
          <Hero feedbacks={feedbacks} avgTicket={avgTicket} onEditTicket={() => { setTicketInput(String(avgTicket)); setEditingTicket(true); }} />

          {/* Urgency panel */}
          <UrgencyPanel
            hot={hotAll.length} warm={warmAll.length} cold={coldAll.length}
            activeFilter={filter} onFilter={setFilter}
          />
        </>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: T.bg, borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'queue',      label: 'Cola de recuperación', badge: totalActionable, badgeColor: T.red   },
          { key: 'validation', label: 'Validar cupones',      badge: pendingCoupons,  badgeColor: T.amber },
        ].map(({ key, label, badge: b, badgeColor }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: tab === key ? T.card : 'transparent',
            color: tab === key ? T.ink : T.muted,
            fontFamily: font, fontSize: '0.82rem', fontWeight: tab === key ? 700 : 500,
            boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {label}
            {b > 0 && <span style={{ background: badgeColor, color: '#fff', borderRadius: 999, fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px' }}>{b}</span>}
          </button>
        ))}
      </div>

      {/* Queue table */}
      {tab === 'queue' && (
        loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3].map(i => <div key={i} style={{ height: 56, background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : queueRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏆</div>
            <div style={{ fontWeight: 800, color: T.ink, fontSize: '1.1rem', marginBottom: 8 }}>
              {filter ? 'Sin clientes en este rango' : 'Sin clientes en riesgo'}
            </div>
            <div style={{ fontSize: '0.88rem', color: T.muted }}>
              {filter ? <button onClick={() => setFilter(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.coral, fontFamily: font, fontSize: '0.88rem', textDecoration: 'underline' }}>Ver todos</button> : 'No hay feedback negativo reciente que requiera acción.'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.bg }}>
                    {['Cal.', 'Sucursal', 'Razón', 'Teléfono', 'Urgencia', ''].map((h, i) => (
                      <th key={i} style={{ padding: '9px 14px', textAlign: i === 5 ? 'right' : 'left', fontSize: '0.65rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queueRows.map(fb => (
                    <TableRow key={fb.id} fb={fb}
                      locationName={locations.find(l => l.id === fb.location_id)?.name}
                      qrLabel={qrLabels[fb.qr_id] || null}
                      bucket={getBucket(fb)}
                      userEmail={userEmail}
                      coupons={coupons}
                      onUpdate={updateFeedback}
                      isEscalated={escalationBanner.some(e => e.id === fb.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {noPhone.length > 0 && !filter && (
              <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 12, background: T.bg, border: `1px solid ${T.border}`, fontSize: '0.78rem', color: T.muted }}>
                <strong style={{ color: T.ink }}>{noPhone.length} sin teléfono</strong> — El formulario ahora pide contacto; esto mejorará con el tiempo.
              </div>
            )}
          </>
        )
      )}

      {tab === 'validation' && !loading && (
        <ValidationTab feedbacks={feedbacks} locations={locations} tenant={tenant} userEmail={userEmail} onUpdate={updateFeedback} />
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
        @keyframes escalate-pulse { 0%,100% { background:#FFF5F5; } 50% { background:#FEE2E2; } }
        tr:hover td { background: #FAFBFC !important; }
      `}</style>
    </div>
  );
}
