import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import {
  AlertTriangle, TrendingDown, TrendingUp, Clock, CheckCircle2,
  Loader, MessageSquare, MapPin, User, RefreshCw, X, ChevronDown,
  ChevronUp, Zap,
} from 'lucide-react';
import { subHours, subDays, format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const T = {
  coral:'#FF5C3A', teal:'#00C9A7', purple:'#7C3AED', ink:'#0D0D12',
  muted:'#6B7280', border:'#E5E7EB', bg:'#F7F8FC', card:'#FFFFFF',
  green:'#16A34A', amber:'#F59E0B', red:'#DC2626',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

// ─── Alert detection ──────────────────────────────────────────────────────────
const TYPE_META = {
  quejas_recientes: { label: 'Quejas recientes',   Icon: AlertTriangle, color: T.red   },
  employee:         { label: 'Empleado en riesgo',  Icon: User,          color: T.coral },
  trend:            { label: 'Baja sostenida',       Icon: TrendingDown,  color: T.amber },
  abandoned:        { label: 'Sin seguimiento',      Icon: Clock,         color: T.muted },
  positive_spike:   { label: 'Oportunidad Google',  Icon: TrendingUp,    color: T.teal  },
};

const SEV_COLOR = { critical: T.red, high: T.coral, medium: T.amber, positive: T.teal };
const SEV_LABEL = { critical: 'CRÍTICO', high: 'ALTO', medium: 'MEDIO', positive: 'OPORTUNIDAD' };

function detectAlerts(feedbacks, locations, employeeQRs) {
  const alerts = [];
  const now = new Date();

  // 1. Quejas recientes — 3+ bad scores same location in 24h
  locations.forEach(loc => {
    const recent = feedbacks.filter(f =>
      f.location_id === loc.id && f.score <= 2 && new Date(f.created_at) > subHours(now, 24)
    );
    if (recent.length >= 3) {
      const avg = (recent.reduce((s, f) => s + f.score, 0) / recent.length).toFixed(1);
      alerts.push({
        id: `quejas-${loc.id}`,
        type: 'quejas_recientes',
        severity: recent.length >= 5 ? 'critical' : 'high',
        entity: loc.name,
        detail: `${recent.length} calificaciones bajas · promedio ${avg}/5`,
        tip: 'Visita la sucursal o llama al encargado — algo está ocurriendo ahora.',
        feedbacks: recent,
        createdAt: recent[0]?.created_at,
      });
    }
  });

  // 2. Empleado en riesgo — avg < 3 with 5+ ratings this week
  employeeQRs.forEach(qr => {
    const weekFbs = feedbacks.filter(f => f.qr_id === qr.id && new Date(f.created_at) > subDays(now, 7));
    if (weekFbs.length >= 5) {
      const avg = weekFbs.reduce((s, f) => s + f.score, 0) / weekFbs.length;
      if (avg < 3) {
        const loc = locations.find(l => l.id === qr.location_id);
        alerts.push({
          id: `employee-${qr.id}`,
          type: 'employee',
          severity: avg < 2 ? 'critical' : 'high',
          entity: qr.label || 'Empleado',
          detail: `Promedio ${avg.toFixed(1)}/5 en ${weekFbs.length} calificaciones · ${loc?.name || ''}`,
          tip: 'Agenda una conversación 1-a-1 hoy. El cliente ya lo está notando.',
          feedbacks: weekFbs,
          createdAt: weekFbs[0]?.created_at,
        });
      }
    }
  });

  // 3. Baja sostenida — drop ≥ 0.5 pts week over week
  locations.forEach(loc => {
    const last7 = feedbacks.filter(f => f.location_id === loc.id && new Date(f.created_at) > subDays(now, 7));
    const prev7 = feedbacks.filter(f => {
      const d = new Date(f.created_at);
      return f.location_id === loc.id && d > subDays(now, 14) && d <= subDays(now, 7);
    });
    if (last7.length >= 5 && prev7.length >= 5) {
      const avgLast = last7.reduce((s, f) => s + f.score, 0) / last7.length;
      const avgPrev = prev7.reduce((s, f) => s + f.score, 0) / prev7.length;
      const drop = avgPrev - avgLast;
      if (drop >= 0.5) {
        alerts.push({
          id: `trend-${loc.id}`,
          type: 'trend',
          severity: drop >= 1 ? 'critical' : 'medium',
          entity: loc.name,
          detail: `Bajó ${drop.toFixed(1)} pts vs semana pasada (${avgPrev.toFixed(1)} → ${avgLast.toFixed(1)})`,
          tip: 'Revisa si cambió algo: staff, menú, horario o proveedor esta semana.',
          feedbacks: last7,
          createdAt: last7[0]?.created_at,
        });
      }
    }
  });

  // 4. Sin seguimiento — coupon sent but no contact +48h
  const abandoned = feedbacks.filter(f =>
    f.recovery_sent && !f.contact_phone && new Date(f.created_at) < subHours(now, 48)
  );
  if (abandoned.length >= 2) {
    alerts.push({
      id: 'abandoned',
      type: 'abandoned',
      severity: 'medium',
      entity: `${abandoned.length} clientes`,
      detail: 'Recibieron cupón pero no dejaron teléfono · sin seguimiento',
      tip: 'Contáctalos en persona en la próxima visita.',
      feedbacks: abandoned,
      createdAt: abandoned[0]?.created_at,
    });
  }

  // 5. Oportunidad Google — 5+ perfect scores in 24h
  locations.forEach(loc => {
    const happy = feedbacks.filter(f =>
      f.location_id === loc.id && f.score === 5 && new Date(f.created_at) > subHours(now, 24)
    );
    if (happy.length >= 5) {
      alerts.push({
        id: `positive-${loc.id}`,
        type: 'positive_spike',
        severity: 'positive',
        entity: loc.name,
        detail: `${happy.length} calificaciones de 5★ hoy · momento ideal para pedir reseña`,
        tip: 'Envía WhatsApp ahora — el cliente está en su punto más feliz.',
        feedbacks: happy,
        createdAt: happy[0]?.created_at,
      });
    }
  });

  const ORDER = { critical: 0, high: 1, medium: 2, positive: 3 };
  return alerts.sort((a, b) => (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9));
}

// ─── Feedback row (read-only, inside expanded alert) ──────────────────────────
function FeedbackRow({ fb }) {
  const score = fb.score;
  const scoreColor = score >= 4 ? T.teal : score >= 3 ? T.amber : T.red;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: `1px solid ${T.border}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: scoreColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: scoreColor, fontSize: '0.95rem', flexShrink: 0 }}>
        {score}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.72rem', color: T.muted, marginBottom: 2 }}>
          {formatDistanceToNow(new Date(fb.created_at), { locale: es, addSuffix: true })}
          {fb.contact_phone && (
            <span style={{ marginLeft: 8, color: '#25D366', fontWeight: 700 }}>📱 {fb.contact_phone}</span>
          )}
        </div>
        {(fb.comment || fb.followup_answer) && (
          <div style={{ fontSize: '0.82rem', color: T.ink, lineHeight: 1.5 }}>
            {fb.followup_answer && <span style={{ color: T.coral, fontWeight: 600 }}>{fb.followup_answer} · </span>}
            {fb.comment}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Alert card ───────────────────────────────────────────────────────────────
function AlertCard({ alert, onDismiss }) {
  const [expanded, setExpanded]   = useState(false);
  const [wasSent, setWasSent]     = useState(false);

  const meta       = TYPE_META[alert.type] || TYPE_META.quejas_recientes;
  const Icon       = meta.Icon;
  const sevColor   = SEV_COLOR[alert.severity] || T.amber;
  const sevLabel   = SEV_LABEL[alert.severity] || 'MEDIO';
  const isPositive = alert.type === 'positive_spike';
  const withPhone  = alert.feedbacks.filter(f => f.contact_phone);

  const handleWhatsApp = () => {
    if (isPositive) {
      withPhone.slice(0, 3).forEach((fb, i) => {
        setTimeout(() => {
          const msg = encodeURIComponent('Hola, notamos que tuviste una gran experiencia con nosotros hoy 🌟 ¿Nos ayudarías compartiendo tu opinión en Google? Solo toma un minuto. ¡Gracias!');
          window.open(`https://wa.me/52${fb.contact_phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
        }, i * 450);
      });
    } else {
      const fb = withPhone[0];
      const msg = encodeURIComponent('Hola, vimos que tu experiencia reciente no fue la que esperabas 😔 Queremos hacer algo para compensarte. ¿Tienes un momento para hablar?');
      window.open(`https://wa.me/52${fb.contact_phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
    }
    setWasSent(true);
  };

  return (
    <div style={{
      background: T.card,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      borderLeft: `4px solid ${sevColor}`,
      overflow: 'hidden',
      boxShadow: alert.severity === 'critical' ? `0 2px 16px ${T.red}14` : 'none',
    }}>
      {/* Main row */}
      <div style={{ padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Icon */}
        <div style={{ width: 38, height: 38, borderRadius: 11, background: sevColor + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
          <Icon size={17} color={sevColor} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: sevColor, background: sevColor + '12', padding: '2px 7px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '.08em' }}>
              {sevLabel}
            </span>
            <span style={{ fontSize: '0.6rem', fontWeight: 600, color: T.muted, background: T.bg, border: `1px solid ${T.border}`, padding: '2px 7px', borderRadius: 999 }}>
              {meta.label}
            </span>
            {alert.createdAt && (
              <span style={{ fontSize: '0.68rem', color: T.muted }}>
                {formatDistanceToNow(new Date(alert.createdAt), { locale: es, addSuffix: true })}
              </span>
            )}
          </div>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: '0.95rem', marginBottom: 2 }}>{alert.entity}</div>
          <div style={{ fontSize: '0.8rem', color: T.muted, marginBottom: 8 }}>{alert.detail}</div>
          {/* AI tip */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: T.purple + '06', border: `1px solid ${T.purple}14`, borderRadius: 8, padding: '7px 10px' }}>
            <Zap size={11} color={T.purple} style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem', color: T.ink, fontStyle: 'italic', lineHeight: 1.5 }}>{alert.tip}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
          {withPhone.length > 0 && !wasSent && (
            <button onClick={handleWhatsApp} style={{
              padding: '7px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: isPositive ? T.teal + '15' : '#25D36618',
              color: isPositive ? T.teal : '#16A34A',
              fontFamily: font, fontSize: '0.75rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
            }}>
              📱 {isPositive ? `Pedir reseña (${withPhone.length})` : 'WhatsApp'}
            </button>
          )}
          {wasSent && (
            <span style={{ fontSize: '0.72rem', color: T.teal, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={12} /> Enviado
            </span>
          )}
          <button onClick={() => onDismiss(alert.id)} style={{
            padding: '7px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: T.green, color: '#fff',
            fontFamily: font, fontSize: '0.75rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
          }}>
            <CheckCircle2 size={12} /> Atendido
          </button>
          <button onClick={() => setExpanded(e => !e)} style={{
            padding: '5px 10px', borderRadius: 8, border: `1px solid ${T.border}`, cursor: 'pointer',
            background: 'none', color: T.muted, fontFamily: font, fontSize: '0.72rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {alert.feedbacks.length} comments
          </button>
        </div>
      </div>

      {/* Expanded feedbacks */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: '8px 18px 14px', background: T.bg + '80' }}>
          {alert.feedbacks.map(fb => <FeedbackRow key={fb.id} fb={fb} />)}
        </div>
      )}
    </div>
  );
}

// ─── Coupon validation tab ────────────────────────────────────────────────────
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
        <div style={{ fontSize: '0.85rem', color: T.muted }}>No hay cupones pendientes de confirmar.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: '0.82rem', color: T.muted, marginBottom: 4 }}>
        {pending.length} cupón{pending.length > 1 ? 'es' : ''} pendiente{pending.length > 1 ? 's' : ''} de validar en caja.
      </p>
      {pending.map(fb => {
        const loc = locations.find(l => l.id === fb.location_id);
        const scoreColor = fb.score >= 4 ? T.teal : fb.score >= 3 ? T.amber : T.red;
        const isSavingR = saving === fb.id;
        const isSavingN = saving === fb.id + '_no';
        return (
          <div key={fb.id} style={{ background: T.card, borderRadius: 14, padding: '14px 16px', border: `1.5px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: scoreColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: scoreColor, flexShrink: 0 }}>
              {fb.score}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: T.ink, fontSize: '0.85rem' }}>🎟 {fb.coupon_code}</div>
              <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 2 }}>
                {loc?.name} · {fb.contact_phone && `📱 ${fb.contact_phone} · `}
                contactado {fb.recovery_at ? formatDistanceToNow(new Date(fb.recovery_at), { locale: es, addSuffix: true }) : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => markRedeemed(fb)} disabled={!!saving} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: T.green, color: '#fff', fontFamily: font, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                {isSavingR ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={12} />} Canjeó
              </button>
              <button onClick={() => markNotReturned(fb)} disabled={!!saving} style={{ padding: '8px 10px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: 'none', color: T.muted, fontFamily: font, fontSize: '0.75rem', cursor: 'pointer' }}>
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
  const [tab, setTab]                 = useState('alerts'); // alerts | validation
  const [dismissed, setDismissed]     = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('retelio_dismissed_alerts') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || ''));
  }, []);

  useEffect(() => {
    if (tenant?.id) loadData();
  }, [tenant?.id]);

  const loadData = async () => {
    setLoading(true);
    const since = subDays(new Date(), 30).toISOString();
    const [fbRes, locRes, locRes2, qrRes] = await Promise.all([
      supabase.from('feedbacks')
        .select('id, location_id, qr_id, score, comment, followup_answer, recovery_sent, routed_to_google, coupon_code, contact_phone, contact_email, created_at, recovery_status, recovery_channel, recovery_at, recovery_actor, coupon_redeemed, coupon_redeemed_at, coupon_redeemed_by, coupon_not_returned')
        .eq('tenant_id', tenant.id)
        .eq('is_test', tenant.test_mode === true)
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      supabase.from('locations').select('id, name').eq('tenant_id', tenant.id),
      supabase.from('Tiendas_Catalogo').select('id, name:nombre').eq('tenant_id', tenant.id),
      supabase.from('qr_codes').select('id, label, location_id').eq('tenant_id', tenant.id).eq('type', 'employee'),
    ]);

    const allLocs = [...(locRes.data || []), ...(locRes2.data || [])];
    setLocations(Object.values(Object.fromEntries(allLocs.map(l => [l.id, l]))));
    setFeedbacks(fbRes.data || []);
    if (qrRes.data) setEmployeeQRs(qrRes.data);
    setLoading(false);
  };

  const alerts = useMemo(() => detectAlerts(feedbacks, locations, employeeQRs), [feedbacks, locations, employeeQRs]);
  const activeAlerts = alerts.filter(a => !dismissed.has(a.id));

  const dismiss = (id) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    localStorage.setItem('retelio_dismissed_alerts', JSON.stringify([...next]));
  };

  const pendingCoupons = feedbacks.filter(f =>
    f.recovery_status === 'contacted' && f.coupon_code && !f.coupon_redeemed && !f.coupon_not_returned
  ).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 32px', maxWidth: 760, margin: '0 auto', fontFamily: font }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: T.ink, marginBottom: 2 }}>Issues</h2>
          <p style={{ fontSize: '0.82rem', color: T.muted }}>
            {loading ? 'Cargando…' : activeAlerts.length === 0 ? 'Sin alertas activas' : `${activeAlerts.length} alerta${activeAlerts.length > 1 ? 's' : ''} activa${activeAlerts.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={loadData} disabled={loading} style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: font, fontSize: '0.8rem', fontWeight: 600, color: T.muted }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: T.bg, borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'alerts',     label: 'Alertas',   badge: activeAlerts.length },
          { key: 'validation', label: 'Validar cupones', badge: pendingCoupons },
        ].map(({ key, label, badge }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: tab === key ? T.card : 'transparent',
            color: tab === key ? T.ink : T.muted,
            fontFamily: font, fontSize: '0.82rem', fontWeight: tab === key ? 700 : 500,
            boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s',
          }}>
            {label}
            {badge > 0 && (
              <span style={{ background: key === 'alerts' ? T.red : T.amber, color: '#fff', borderRadius: 999, fontSize: '0.65rem', fontWeight: 800, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'alerts' && (
        loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2].map(i => (
              <div key={i} style={{ height: 120, background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : activeAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, color: T.ink, marginBottom: 6 }}>Todo bajo control</div>
            <div style={{ fontSize: '0.85rem', color: T.muted }}>No hay alertas activas en este momento.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} onDismiss={dismiss} />
            ))}
            {dismissed.size > 0 && (
              <button onClick={() => {
                setDismissed(new Set());
                localStorage.removeItem('retelio_dismissed_alerts');
              }} style={{ alignSelf: 'center', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: T.muted, fontFamily: font, padding: '8px', textDecoration: 'underline' }}>
                Mostrar {dismissed.size} alerta{dismissed.size > 1 ? 's' : ''} descartada{dismissed.size > 1 ? 's' : ''}
              </button>
            )}
          </div>
        )
      )}

      {tab === 'validation' && !loading && (
        <ValidationTab
          feedbacks={feedbacks}
          locations={locations}
          tenant={tenant}
          userEmail={userEmail}
          onUpdate={updated => setFeedbacks(prev => prev.map(f => f.id === updated.id ? updated : f))}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
