import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import {
  AlertTriangle, Zap, TrendingDown, Users, Clock,
  CheckCircle2, Loader, ChevronRight, MessageSquare, MapPin,
  User, RefreshCw, Eye, X, Info, Star
} from 'lucide-react';
import { subHours, subDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

const T = {
  coral:'#FF5C3A', teal:'#00C9A7', purple:'#7C3AED', ink:'#0D0D12',
  muted:'#6B7280', border:'#E5E7EB', bg:'#F7F8FC', card:'#FFFFFF',
  green:'#16A34A', amber:'#F59E0B', red:'#DC2626',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

// ─── AI suggestions per alert type ───────────────────────────────────────────
const AI_TIPS = {
  cluster: [
    'Visita la sucursal de inmediato — algo sistémico está ocurriendo ahora.',
    'Revisa si hay un empleado nuevo en turno o un producto con problema.',
    'Activa el protocolo de recuperación: cupón + llamada al cliente.',
  ],
  employee: [
    'Agenda una sesión de feedback 1-a-1 con el empleado.',
    'Revisa si hay factores externos: carga de trabajo, horario, equipo.',
    'Considera reasignar temporalmente mientras se investiga.',
  ],
  trend: [
    'Compara con cambios recientes: menú, staff, horarios o proveedores.',
    'Envía a un "cliente misterioso" esta semana.',
    'Revisión de procesos de la sucursal afectada.',
  ],
  abandoned_recovery: [
    'El cliente ya recibió un cupón — el seguimiento humano duplica la retención.',
    'Asigna a un manager para hacer la llamada hoy antes de que expire el cupón.',
  ],
};

function getRandomTip(type) {
  const tips = AI_TIPS[type] || [];
  return tips[Math.floor(Math.random() * tips.length)] || '';
}

// ─── Detect alerts from feedbacks ────────────────────────────────────────────
function detectAlerts(feedbacks, locations, employeeQRs) {
  const alerts = [];
  const now = new Date();

  // 1. CLUSTER: 3+ bad scores at same location in last 24h
  locations.forEach(loc => {
    const recent = feedbacks.filter(f =>
      f.location_id === loc.id &&
      f.score <= 2 &&
      new Date(f.created_at) > subHours(now, 24)
    );
    if (recent.length >= 3) {
      const avg = (recent.reduce((s, f) => s + f.score, 0) / recent.length).toFixed(1);
      alerts.push({
        id: `cluster-${loc.id}`,
        type: 'cluster',
        severity: recent.length >= 5 ? 'critical' : 'high',
        title: `Cluster de feedback negativo`,
        entity: loc.name,
        entityType: 'location',
        detail: `${recent.length} calificaciones ≤2 en las últimas 24h · promedio ${avg}/5`,
        feedbacks: recent,
        tip: getRandomTip('cluster'),
        createdAt: recent[0]?.created_at,
      });
    }
  });

  // 2. EMPLOYEE: avg score < 3 with 5+ feedbacks this week
  employeeQRs.forEach(qr => {
    const weekFbs = feedbacks.filter(f =>
      f.qr_id === qr.id && new Date(f.created_at) > subDays(now, 7)
    );
    if (weekFbs.length >= 5) {
      const avg = weekFbs.reduce((s, f) => s + f.score, 0) / weekFbs.length;
      if (avg < 3) {
        const loc = locations.find(l => l.id === qr.location_id);
        alerts.push({
          id: `employee-${qr.id}`,
          type: 'employee',
          severity: avg < 2 ? 'critical' : 'high',
          title: `Desempeño bajo · empleado`,
          entity: qr.label || 'Empleado sin nombre',
          entityType: 'employee',
          entitySub: loc?.name,
          detail: `Promedio ${avg.toFixed(1)}/5 en ${weekFbs.length} feedbacks esta semana`,
          feedbacks: weekFbs,
          tip: getRandomTip('employee'),
          createdAt: weekFbs[0]?.created_at,
        });
      }
    }
  });

  // 3. TREND: location score dropped >0.5 comparing last 7 vs previous 7 days
  locations.forEach(loc => {
    const last7 = feedbacks.filter(f =>
      f.location_id === loc.id && new Date(f.created_at) > subDays(now, 7)
    );
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
          title: `Tendencia a la baja`,
          entity: loc.name,
          entityType: 'location',
          detail: `Calificación bajó ${drop.toFixed(1)} pts vs semana anterior (${avgPrev.toFixed(1)} → ${avgLast.toFixed(1)})`,
          feedbacks: last7,
          tip: getRandomTip('trend'),
          createdAt: last7[0]?.created_at,
        });
      }
    }
  });

  // 4. ABANDONED RECOVERY: recovery_sent=true but no contact_phone and feedback > 48h ago
  const abandoned = feedbacks.filter(f =>
    f.recovery_sent &&
    !f.contact_phone &&
    new Date(f.created_at) < subHours(now, 48)
  );
  if (abandoned.length >= 2) {
    alerts.push({
      id: 'abandoned-recovery',
      type: 'abandoned_recovery',
      severity: 'medium',
      title: `Recuperaciones sin seguimiento`,
      entity: `${abandoned.length} clientes`,
      entityType: 'group',
      detail: `Recibieron cupón pero no dejaron contacto · llevan más de 48h sin seguimiento`,
      feedbacks: abandoned,
      tip: getRandomTip('abandoned_recovery'),
      createdAt: abandoned[0]?.created_at,
    });
  }

  // Sort by severity
  const ORDER = { critical: 0, high: 1, medium: 2 };
  return alerts.sort((a, b) => (ORDER[a.severity] || 9) - (ORDER[b.severity] || 9));
}

// ─── Severity config ──────────────────────────────────────────────────────────
const SEV = {
  critical: { color: T.red,    bg: T.red + '12',    label: 'CRÍTICO',  dot: T.red },
  high:     { color: T.coral,  bg: T.coral + '12',  label: 'ALTO',     dot: T.coral },
  medium:   { color: T.amber,  bg: T.amber + '12',  label: 'MEDIO',    dot: T.amber },
};

const TYPE_ICONS = {
  cluster:            AlertTriangle,
  employee:           User,
  trend:              TrendingDown,
  abandoned_recovery: Clock,
};

// ─── Alert card ───────────────────────────────────────────────────────────────
function AlertCard({ alert, onDismiss, onViewFeedbacks }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEV[alert.severity] || SEV.medium;
  const Icon = TYPE_ICONS[alert.type] || AlertTriangle;

  return (
    <div style={{
      background: T.card, borderRadius: 18,
      border: `2px solid ${sev.color}22`,
      overflow: 'hidden',
      boxShadow: alert.severity === 'critical' ? `0 4px 20px ${T.red}18` : 'none',
    }}>
      {/* Top bar */}
      <div style={{ height: 3, background: sev.color, opacity: 0.7 }} />

      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          {/* Icon */}
          <div style={{ width: 40, height: 40, borderRadius: 12, background: sev.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={18} color={sev.color} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.62rem', fontWeight: 800, color: sev.color, background: sev.bg, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{sev.label}</span>
              <span style={{ fontSize: '0.62rem', color: T.muted }}>{alert.createdAt ? format(new Date(alert.createdAt), "d MMM · HH:mm", { locale: es }) : ''}</span>
            </div>
            <div style={{ fontWeight: 800, color: T.ink, fontSize: '0.95rem', marginBottom: 2 }}>{alert.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontWeight: 700, color: sev.color, fontSize: '0.88rem' }}>{alert.entity}</span>
              {alert.entitySub && <span style={{ fontSize: '0.78rem', color: T.muted }}>· {alert.entitySub}</span>}
            </div>
            <div style={{ fontSize: '0.8rem', color: T.muted, marginTop: 4 }}>{alert.detail}</div>
          </div>

          <button onClick={() => onDismiss(alert.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* AI Tip */}
        <div style={{ background: `linear-gradient(135deg, ${T.purple}08, ${T.teal}08)`, borderRadius: 10, padding: '10px 12px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start', border: `1px solid ${T.purple}18` }}>
          <Zap size={13} color={T.purple} style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: '0.78rem', color: T.ink, lineHeight: 1.5, fontStyle: 'italic' }}>{alert.tip}</span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => onViewFeedbacks(alert)} style={{
            padding: '7px 14px', borderRadius: 9, border: `1.5px solid ${T.border}`,
            background: 'none', cursor: 'pointer', fontFamily: font,
            fontSize: '0.78rem', fontWeight: 700, color: T.ink,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Eye size={13} /> Ver {alert.feedbacks.length} feedbacks
          </button>
          {expanded && (
            <button onClick={() => setExpanded(false)} style={{ padding: '7px 14px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: 'none', cursor: 'pointer', fontFamily: font, fontSize: '0.78rem', fontWeight: 600, color: T.muted }}>
              Ocultar
            </button>
          )}
          <button onClick={() => onDismiss(alert.id)} style={{
            padding: '7px 16px', borderRadius: 9, border: 'none',
            background: T.green, color: '#fff', cursor: 'pointer',
            fontFamily: font, fontSize: '0.78rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto',
          }}>
            <CheckCircle2 size={13} /> Marcar atendido
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Feedback detail panel ────────────────────────────────────────────────────
function FeedbackPanel({ alert, locations, onClose }) {
  if (!alert) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: T.card, width: '100%', maxWidth: 480, height: '100vh', overflowY: 'auto', padding: 24, boxShadow: '-8px 0 32px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontWeight: 800, color: T.ink, fontSize: '1rem' }}>{alert.entity} · feedbacks afectados</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alert.feedbacks.map(fb => {
            const loc = locations.find(l => l.id === fb.location_id);
            return (
              <div key={fb.id} style={{ background: T.bg, borderRadius: 14, padding: '14px 16px', border: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: T.red + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: T.red, fontSize: '0.9rem' }}>
                    {fb.score}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: T.ink }}>{loc?.name || '—'}</div>
                    <div style={{ fontSize: '0.7rem', color: T.muted }}>{format(new Date(fb.created_at), "d MMM yyyy · HH:mm", { locale: es })}</div>
                  </div>
                  {fb.recovery_sent && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700, color: T.coral, background: T.coral + '15', padding: '2px 8px', borderRadius: 999 }}>Cupón enviado</span>
                  )}
                </div>
                {fb.comment && <div style={{ fontSize: '0.82rem', color: T.muted, fontStyle: 'italic' }}>"{fb.comment}"</div>}
                {fb.followup_answer && <div style={{ fontSize: '0.78rem', color: T.purple, marginTop: 4 }}>↳ {fb.followup_answer}</div>}
                {fb.contact_phone && (
                  <a href={`https://wa.me/52${fb.contact_phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, padding: '4px 10px', borderRadius: 8, background: '#25D36618', color: '#25D366', fontSize: '0.72rem', fontWeight: 700, textDecoration: 'none' }}>
                    <MessageSquare size={11} /> {fb.contact_phone}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function IssueManagement() {
  const { tenant } = useTenant();
  const [feedbacks, setFeedbacks]   = useState([]);
  const [locations, setLocations]   = useState([]);
  const [employeeQRs, setEmployeeQRs] = useState([]);
  const [dismissed, setDismissed]   = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('retelio_dismissed_alerts') || '[]')); }
    catch { return new Set(); }
  });
  const [loading, setLoading]       = useState(true);
  const [activePanel, setActivePanel] = useState(null);
  const [tab, setTab]               = useState('active'); // active | resolved

  useEffect(() => { if (tenant?.id) loadData(); }, [tenant?.id]);

  const loadData = async () => {
    setLoading(true);
    const since = subDays(new Date(), 30).toISOString();
    const [fbRes, locRes, qrRes] = await Promise.all([
      supabase.from('feedbacks')
        .select('id, location_id, qr_id, score, comment, followup_answer, recovery_sent, coupon_code, contact_phone, created_at')
        .eq('tenant_id', tenant.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      supabase.from('locations').select('id, name').eq('tenant_id', tenant.id),
      supabase.from('qr_codes').select('id, label, location_id, type').eq('tenant_id', tenant.id).eq('type', 'employee'),
    ]);
    if (fbRes.data)  setFeedbacks(fbRes.data);
    if (locRes.data) setLocations(locRes.data);
    if (qrRes.data)  setEmployeeQRs(qrRes.data);
    setLoading(false);
  };

  const allAlerts = useMemo(() => detectAlerts(feedbacks, locations, employeeQRs), [feedbacks, locations, employeeQRs]);
  const alerts = allAlerts.filter(a => !dismissed.has(a.id));
  const resolvedCount = dismissed.size;

  const dismiss = (id) => {
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    localStorage.setItem('retelio_dismissed_alerts', JSON.stringify([...next]));
  };

  // Summary stats
  const stats = useMemo(() => ({
    unhappy24h: feedbacks.filter(f => f.score <= 2 && new Date(f.created_at) > subHours(new Date(), 24)).length,
    recoveryPending: feedbacks.filter(f => f.recovery_sent && !f.contact_phone && new Date(f.created_at) > subDays(new Date(), 7)).length,
    critical: allAlerts.filter(a => a.severity === 'critical').length,
  }), [feedbacks, allAlerts]);

  return (
    <div style={{ fontFamily: font, padding: 28, background: T.bg, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 4 }}>Centro de Alertas</h1>
          <p style={{ fontSize: '0.85rem', color: T.muted }}>Detección automática de patrones · últimos 30 días</p>
        </div>
        <button onClick={loadData} style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.card, cursor: 'pointer', color: T.muted, display: 'flex', alignItems: 'center', gap: 6, fontFamily: font, fontSize: '0.8rem', fontWeight: 600 }}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Alertas activas', value: alerts.length, color: alerts.length > 0 ? T.coral : T.green, Icon: AlertTriangle },
          { label: 'Negativos últimas 24h', value: stats.unhappy24h, color: stats.unhappy24h > 0 ? T.red : T.green, Icon: TrendingDown },
          { label: 'Recuperaciones pendientes', value: stats.recoveryPending, color: stats.recoveryPending > 0 ? T.amber : T.green, Icon: Clock },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} style={{ background: T.card, borderRadius: 16, padding: '16px 20px', border: `1.5px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon size={14} color={color} />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 20, width: 'fit-content' }}>
        {[['active', `Activas (${alerts.length})`], ['resolved', `Atendidas (${resolvedCount})`]].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)} style={{
            padding: '7px 18px', borderRadius: 9, border: 'none',
            background: tab === val ? T.ink : 'transparent',
            color: tab === val ? '#fff' : T.muted,
            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: font,
          }}>{label}</button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Analizando patrones…
        </div>
      ) : tab === 'active' ? (
        alerts.length === 0 ? (
          <div style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: T.ink, marginBottom: 8 }}>¡Sin alertas activas!</div>
            <div style={{ fontSize: '0.88rem', color: T.muted, maxWidth: 360, margin: '0 auto' }}>
              No se detectaron patrones problemáticos en los últimos 30 días. Retelio monitorea continuamente.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {alerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={dismiss}
                onViewFeedbacks={a => setActivePanel(a)}
              />
            ))}
          </div>
        )
      ) : (
        <div style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, padding: '32px 24px', textAlign: 'center' }}>
          <CheckCircle2 size={32} color={T.green} style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 700, color: T.ink, marginBottom: 6 }}>{resolvedCount} alertas atendidas</div>
          <div style={{ fontSize: '0.85rem', color: T.muted }}>Las alertas atendidas se limpian al refrescar la página.</div>
          <button onClick={() => { setDismissed(new Set()); localStorage.removeItem('retelio_dismissed_alerts'); }} style={{ marginTop: 16, padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: 'none', cursor: 'pointer', fontFamily: font, fontSize: '0.82rem', fontWeight: 600, color: T.muted }}>
            Restaurar todas
          </button>
        </div>
      )}

      {/* Feedback detail panel */}
      {activePanel && (
        <FeedbackPanel alert={activePanel} locations={locations} onClose={() => setActivePanel(null)} />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
