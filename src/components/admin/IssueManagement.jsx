import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import {
  CheckCircle2, Loader, RefreshCw, X, ChevronDown, ChevronUp,
  MessageSquare, Phone, Edit2,
} from 'lucide-react';
import { subHours, subDays, startOfMonth, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const T = {
  coral:'#FF5C3A', teal:'#00C9A7', purple:'#7C3AED', ink:'#0D0D12',
  muted:'#6B7280', border:'#E5E7EB', bg:'#F7F8FC', card:'#FFFFFF',
  green:'#16A34A', amber:'#F59E0B', red:'#DC2626',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

// ─── WhatsApp message — uses customer's exact words ───────────────────────────
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

// ─── Timer countdown ──────────────────────────────────────────────────────────
function Timer({ createdAt }) {
  const calc = () => {
    const mins = 120 - Math.floor((Date.now() - new Date(createdAt)) / 60000);
    return Math.max(0, mins);
  };
  const [mins, setMins] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setMins(calc()), 30000);
    return () => clearInterval(t);
  }, [createdAt]);

  if (mins === 0) return <span style={{ fontSize: '0.72rem', color: T.red, fontWeight: 700 }}>⏰ Ventana cerrada</span>;
  const isUrgent = mins < 30;
  const label = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : `${mins} min`;
  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isUrgent ? T.red : T.amber }}>
      ⏰ {label} restantes
    </span>
  );
}

// ─── Recovery card ────────────────────────────────────────────────────────────
function RecoveryCard({ fb, locationName, userEmail, isHot, onUpdate }) {
  const [saving, setSaving]     = useState(false);
  const [expanded, setExpanded] = useState(false);
  const contacted = fb.recovery_status === 'contacted' || fb.recovery_status === 'resolved';
  const resolved  = fb.recovery_status === 'resolved' || fb.coupon_redeemed;
  const scoreColor = fb.score === 1 ? T.red : T.coral;

  const handleWhatsApp = async () => {
    const msg = encodeURIComponent(buildMessage(fb, locationName));
    window.open(`https://wa.me/52${fb.contact_phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
    if (contacted) return;
    setSaving(true);
    const now = new Date().toISOString();
    const update = { recovery_status: 'contacted', recovery_at: now, recovery_actor: userEmail };
    await supabase.from('feedbacks').update(update).eq('id', fb.id);
    onUpdate({ ...fb, ...update });
    setSaving(false);
  };

  const handleResolved = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const update = { recovery_status: 'resolved', recovery_resolved_at: now };
    await supabase.from('feedbacks').update(update).eq('id', fb.id);
    onUpdate({ ...fb, ...update });
    setSaving(false);
  };

  return (
    <div style={{
      background: T.card,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      borderLeft: `4px solid ${resolved ? T.teal : isHot ? T.red : T.amber}`,
      overflow: 'hidden',
      opacity: resolved ? 0.6 : 1,
    }}>
      <div style={{ padding: '16px 18px' }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* Score badge */}
          <div style={{ width: 40, height: 40, borderRadius: 11, background: scoreColor + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: scoreColor, fontSize: '1.1rem', flexShrink: 0 }}>
            {fb.score}★
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: T.ink }}>{locationName || '—'}</span>
              <span style={{ fontSize: '0.72rem', color: T.muted }}>
                {formatDistanceToNow(new Date(fb.created_at), { locale: es, addSuffix: true })}
              </span>
              {isHot && !contacted && <Timer createdAt={fb.created_at} />}
              {contacted && !resolved && (
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: T.teal, background: T.teal + '12', padding: '2px 8px', borderRadius: 999 }}>
                  ✓ Contactado
                </span>
              )}
              {resolved && (
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: T.green, background: T.green + '12', padding: '2px 8px', borderRadius: 999 }}>
                  ✓ Recuperado
                </span>
              )}
            </div>

            {/* Customer's words */}
            {(fb.comment || fb.followup_answer) && (
              <div style={{ fontSize: '0.88rem', color: T.ink, lineHeight: 1.55, marginBottom: 8 }}>
                {fb.followup_answer && <span style={{ color: T.coral, fontWeight: 600 }}>{fb.followup_answer}{fb.comment ? ' · ' : ''}</span>}
                {fb.comment && `"${fb.comment}"`}
              </div>
            )}

            {/* Phone */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Phone size={12} color="#25D366" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16A34A' }}>{fb.contact_phone}</span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={handleWhatsApp}
                disabled={saving || resolved}
                style={{
                  padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: contacted ? '#25D36620' : '#25D366',
                  color: contacted ? '#16A34A' : '#fff',
                  fontFamily: font, fontSize: '0.8rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {saving ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <MessageSquare size={13} />}
                {contacted ? 'Reenviar WhatsApp' : '📱 Abrir WhatsApp'}
              </button>

              {contacted && !resolved && (
                <button
                  onClick={handleResolved}
                  disabled={saving}
                  style={{
                    padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: T.teal, color: '#fff',
                    fontFamily: font, fontSize: '0.8rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <CheckCircle2 size={13} /> Regresó ✓
                </button>
              )}

              <button
                onClick={() => setExpanded(e => !e)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.muted, display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', fontFamily: font }}
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                ver mensaje
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded: pre-filled WA message preview */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: '12px 18px', background: T.bg }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
            Mensaje pre-llenado para WhatsApp
          </div>
          <div style={{ fontSize: '0.82rem', color: T.ink, lineHeight: 1.6, background: '#fff', borderRadius: 10, padding: '10px 12px', border: `1px solid ${T.border}`, fontStyle: 'italic' }}>
            "{buildMessage(fb, locationName)}"
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function Section({ label, color, count, children }) {
  if (count === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '.1em' }}>{label}</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted }}>· {count}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

// ─── Hero metric ──────────────────────────────────────────────────────────────
function Hero({ feedbacks, avgTicket, onEditTicket }) {
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();

  const badThisMonth     = feedbacks.filter(f => f.score <= 2 && f.created_at > monthStart);
  const recoveredThisMonth = feedbacks.filter(f =>
    f.score <= 2 && f.created_at > monthStart &&
    (f.recovery_status === 'resolved' || f.coupon_redeemed)
  );
  const withPhone = badThisMonth.filter(f => f.contact_phone);
  const rate      = withPhone.length > 0 ? Math.round(recoveredThisMonth.length / withPhone.length * 100) : 0;
  const revenue   = recoveredThisMonth.length * avgTicket;

  return (
    <div style={{ background: T.card, borderRadius: 18, padding: '20px 24px', border: `1px solid ${T.border}`, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>

        {/* Revenue */}
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
            💰 Revenue recuperado este mes
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em' }}>
            ${revenue.toLocaleString('es-MX')}
          </div>
          <div style={{ fontSize: '0.78rem', color: T.muted, marginTop: 2 }}>
            {recoveredThisMonth.length} de {withPhone.length} clientes con teléfono
          </div>
        </div>

        {/* Rate bar */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted }}>Tasa de recuperación</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: rate >= 60 ? T.teal : rate >= 30 ? T.amber : T.red }}>{rate}%</span>
          </div>
          <div style={{ height: 8, background: T.border, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${rate}%`, background: rate >= 60 ? T.teal : rate >= 30 ? T.amber : T.red, borderRadius: 99, transition: 'width .6s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            <div style={{ fontSize: '0.72rem', color: T.muted }}>
              <strong style={{ color: T.green }}>{recoveredThisMonth.length}</strong> recuperados
            </div>
            <div style={{ fontSize: '0.72rem', color: T.muted }}>
              <strong style={{ color: T.amber }}>{withPhone.length - recoveredThisMonth.length}</strong> pendientes
            </div>
          </div>
        </div>

        {/* Avg ticket config */}
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
    f.recovery_status === 'contacted' && f.coupon_code && !f.coupon_redeemed && !f.coupon_not_returned
  );

  const markRedeemed = async (fb) => {
    setSaving(fb.id);
    const now = new Date().toISOString();
    const update = { coupon_redeemed: true, coupon_redeemed_at: now, coupon_redeemed_by: userEmail, recovery_status: 'resolved', recovery_resolved_at: now };
    await supabase.from('feedbacks').update(update).eq('id', fb.id).eq('tenant_id', tenant.id);
    onUpdate({ ...fb, ...update });
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: '0.82rem', color: T.muted, marginBottom: 4 }}>
        {pending.length} cupón{pending.length !== 1 ? 'es' : ''} pendiente{pending.length !== 1 ? 's' : ''} — confirma si el cliente llegó.
      </p>
      {pending.map(fb => {
        const loc = locations.find(l => l.id === fb.location_id);
        const scoreColor = fb.score <= 1 ? T.red : T.coral;
        const isSavingR  = saving === fb.id;
        const isSavingN  = saving === fb.id + '_no';
        return (
          <div key={fb.id} style={{ background: T.card, borderRadius: 14, padding: '14px 16px', border: `1.5px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: scoreColor + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: scoreColor, flexShrink: 0 }}>
              {fb.score}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: T.ink, fontSize: '0.85rem' }}>🎟 {fb.coupon_code}</div>
              <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 2 }}>
                {loc?.name}{fb.contact_phone ? ` · 📱 ${fb.contact_phone}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => markRedeemed(fb)} disabled={!!saving} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: T.green, color: '#fff', fontFamily: font, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                {isSavingR ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={12} />} Canjeó
              </button>
              <button onClick={() => markNotReturned(fb)} disabled={!!saving} style={{ padding: '8px 10px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: 'none', color: T.muted, fontFamily: font, fontSize: '0.78rem', cursor: 'pointer' }}>
                {isSavingN ? <Loader size={12} /> : '✗'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function IssueManagement() {
  const { tenant } = useTenant();
  const [feedbacks, setFeedbacks]     = useState([]);
  const [locations, setLocations]     = useState([]);
  const [employeeQRs, setEmployeeQRs] = useState([]);
  const [userEmail, setUserEmail]     = useState('');
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('queue');
  const [avgTicket, setAvgTicket]     = useState(() => Number(localStorage.getItem('retelio_avg_ticket') || 350));
  const [editingTicket, setEditingTicket] = useState(false);
  const [ticketInput, setTicketInput] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || ''));
  }, []);

  useEffect(() => {
    if (tenant?.id) loadData();
  }, [tenant?.id]);

  const loadData = async () => {
    setLoading(true);
    const since = subDays(new Date(), 30).toISOString();
    const [fbRes, locRes, locRes2] = await Promise.all([
      supabase.from('feedbacks')
        .select('id, location_id, qr_id, score, comment, followup_answer, contact_phone, contact_email, created_at, recovery_status, recovery_at, recovery_actor, recovery_resolved_at, coupon_code, coupon_redeemed, coupon_redeemed_at, coupon_redeemed_by, coupon_not_returned, recovery_sent')
        .eq('tenant_id', tenant.id)
        .eq('is_test', tenant.test_mode === true)
        .lte('score', 2)
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      supabase.from('locations').select('id, name').eq('tenant_id', tenant.id),
      supabase.from('Tiendas_Catalogo').select('id, name:nombre').eq('tenant_id', tenant.id),
    ]);
    const allLocs = [...(locRes.data || []), ...(locRes2.data || [])];
    setLocations(Object.values(Object.fromEntries(allLocs.map(l => [l.id, l]))));
    setFeedbacks(fbRes.data || []);
    setLoading(false);
  };

  const updateFeedback = useCallback(updated => {
    setFeedbacks(prev => prev.map(f => f.id === updated.id ? updated : f));
  }, []);

  const saveTicket = () => {
    const val = parseInt(ticketInput);
    if (val > 0) {
      setAvgTicket(val);
      localStorage.setItem('retelio_avg_ticket', val);
    }
    setEditingTicket(false);
  };

  const now = new Date();

  // ── Queue buckets ──────────────────────────────────────────────────────────
  const pending = feedbacks.filter(f => !f.recovery_status || f.recovery_status === 'pending');
  const hot     = pending.filter(f => f.contact_phone && new Date(f.created_at) > subHours(now, 2));
  const warm    = pending.filter(f => f.contact_phone && new Date(f.created_at) <= subHours(now, 2) && new Date(f.created_at) > subHours(now, 24));
  const noPhone = pending.filter(f => !f.contact_phone);
  const contacted = feedbacks.filter(f => f.recovery_status === 'contacted');

  const pendingCoupons = feedbacks.filter(f =>
    f.recovery_status === 'contacted' && f.coupon_code && !f.coupon_redeemed && !f.coupon_not_returned
  ).length;

  const totalActionable = hot.length + warm.length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto', fontFamily: font }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: T.ink, marginBottom: 2 }}>Recuperación</h2>
          <p style={{ fontSize: '0.82rem', color: T.muted }}>
            {loading ? 'Cargando…' : totalActionable === 0 ? 'Sin clientes pendientes de contactar' : `${totalActionable} cliente${totalActionable !== 1 ? 's' : ''} por contactar`}
          </p>
        </div>
        <button onClick={loadData} disabled={loading} style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: font, fontSize: '0.8rem', fontWeight: 600, color: T.muted }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Actualizar
        </button>
      </div>

      {/* Avg ticket edit modal */}
      {editingTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEditingTicket(false)}>
          <div style={{ background: T.card, borderRadius: 20, padding: '28px 32px', width: 300, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 800, color: T.ink, marginBottom: 8 }}>Ticket promedio</h3>
            <p style={{ fontSize: '0.82rem', color: T.muted, marginBottom: 16 }}>Se usa para calcular el revenue recuperado.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ alignSelf: 'center', fontWeight: 700, color: T.muted }}>$</span>
              <input
                autoFocus
                type="number"
                value={ticketInput}
                onChange={e => setTicketInput(e.target.value)}
                placeholder={String(avgTicket)}
                onKeyDown={e => e.key === 'Enter' && saveTicket()}
                style={{ flex: 1, border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 14px', fontFamily: font, fontSize: '1rem', outline: 'none' }}
              />
              <span style={{ alignSelf: 'center', fontSize: '0.8rem', color: T.muted }}>MXN</span>
            </div>
            <button onClick={saveTicket} style={{ width: '100%', marginTop: 14, padding: '12px', borderRadius: 12, border: 'none', background: T.coral, color: '#fff', fontFamily: font, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      {!loading && (
        <Hero
          feedbacks={feedbacks}
          avgTicket={avgTicket}
          onEditTicket={() => { setTicketInput(String(avgTicket)); setEditingTicket(true); }}
        />
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: T.bg, borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'queue',      label: 'Cola de recuperación', badge: totalActionable },
          { key: 'validation', label: 'Validar cupones',      badge: pendingCoupons  },
        ].map(({ key, label, badge }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: tab === key ? T.card : 'transparent',
            color: tab === key ? T.ink : T.muted,
            fontFamily: font, fontSize: '0.82rem', fontWeight: tab === key ? 700 : 500,
            boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {label}
            {badge > 0 && (
              <span style={{ background: key === 'queue' ? T.red : T.amber, color: '#fff', borderRadius: 999, fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px' }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Recovery queue */}
      {tab === 'queue' && (
        loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 100, background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : totalActionable === 0 && contacted.length === 0 && noPhone.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏆</div>
            <div style={{ fontWeight: 800, color: T.ink, fontSize: '1.1rem', marginBottom: 8 }}>Sin clientes en riesgo</div>
            <div style={{ fontSize: '0.88rem', color: T.muted, lineHeight: 1.6 }}>
              No hay feedback negativo reciente que requiera acción.
            </div>
          </div>
        ) : (
          <>
            <Section label="Actuar ahora" color={T.red} count={hot.length}>
              {hot.map(fb => (
                <RecoveryCard key={fb.id} fb={fb}
                  locationName={locations.find(l => l.id === fb.location_id)?.name}
                  userEmail={userEmail} isHot={true} onUpdate={updateFeedback} />
              ))}
            </Section>

            <Section label="Actuar hoy" color={T.amber} count={warm.length}>
              {warm.map(fb => (
                <RecoveryCard key={fb.id} fb={fb}
                  locationName={locations.find(l => l.id === fb.location_id)?.name}
                  userEmail={userEmail} isHot={false} onUpdate={updateFeedback} />
              ))}
            </Section>

            <Section label="Ya contactados" color={T.teal} count={contacted.length}>
              {contacted.map(fb => (
                <RecoveryCard key={fb.id} fb={fb}
                  locationName={locations.find(l => l.id === fb.location_id)?.name}
                  userEmail={userEmail} isHot={false} onUpdate={updateFeedback} />
              ))}
            </Section>

            {noPhone.length > 0 && (
              <div style={{ marginTop: 8, padding: '14px 18px', borderRadius: 14, background: T.bg, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>
                  Sin número de contacto · {noPhone.length}
                </div>
                <div style={{ fontSize: '0.8rem', color: T.muted }}>
                  {noPhone.length} cliente{noPhone.length !== 1 ? 's' : ''} con calificación baja pero sin teléfono. El formulario ahora pide contacto — esto mejorará con el tiempo.
                </div>
              </div>
            )}
          </>
        )
      )}

      {tab === 'validation' && !loading && (
        <ValidationTab feedbacks={feedbacks} locations={locations} tenant={tenant} userEmail={userEmail} onUpdate={updateFeedback} />
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:.5; } }
      `}</style>
    </div>
  );
}
