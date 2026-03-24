import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import {
  AlertTriangle, Zap, TrendingDown, TrendingUp, Clock,
  CheckCircle2, Loader, MessageSquare, MapPin,
  User, RefreshCw, Eye, X, Info, ChevronDown, Search,
  ThumbsUp, Send, Phone, Mail, Users, Star, AlertCircle,
  ExternalLink, ClipboardCheck, FileText,
} from 'lucide-react';
import { subHours, subDays, format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const T = {
  coral:'#FF5C3A', teal:'#00C9A7', purple:'#7C3AED', ink:'#0D0D12',
  muted:'#6B7280', border:'#E5E7EB', bg:'#F7F8FC', card:'#FFFFFF',
  green:'#16A34A', amber:'#F59E0B', red:'#DC2626',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
          transform: 'translateX(-50%)',
          background: T.ink, color: '#fff', fontSize: '0.72rem', fontWeight: 500,
          padding: '6px 10px', borderRadius: 8, whiteSpace: 'normal', maxWidth: 260,
          textAlign: 'center', lineHeight: 1.4,
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)', zIndex: 9999, pointerEvents: 'none',
          fontFamily: font,
        }}>
          {text}
          <span style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: '5px 5px 0', borderStyle: 'solid', borderColor: `${T.ink} transparent transparent` }} />
        </span>
      )}
    </span>
  );
}

// ─── AI suggestions per alert type ───────────────────────────────────────────
const AI_TIPS = {
  quejas_recientes: [
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
  positive_spike: [
    'Este es el momento ideal para pedir reseña en Google — el cliente está en su punto más feliz.',
    'Captura el momentum: comparte en redes sociales y agradece al equipo.',
    'Activa el flujo de Google review para los clientes de hoy.',
  ],
};

function getRandomTip(type) {
  const tips = AI_TIPS[type] || [];
  return tips[Math.floor(Math.random() * tips.length)] || '';
}

// ─── Alert type metadata ──────────────────────────────────────────────────────
const TYPE_META = {
  quejas_recientes: {
    label: 'Quejas recientes',
    tooltip: '3 o más calificaciones malas en la misma sucursal en las últimas 24 horas. Indica un problema activo que necesita atención inmediata.',
    Icon: AlertTriangle,
  },
  employee: {
    label: 'Empleado en riesgo',
    tooltip: 'Un empleado tiene promedio menor a 3/5 con al menos 5 calificaciones esta semana. Requiere conversación de seguimiento.',
    Icon: User,
  },
  trend: {
    label: 'Baja sostenida',
    tooltip: 'La calificación de una sucursal bajó más de 0.5 puntos comparando esta semana contra la semana anterior.',
    Icon: TrendingDown,
  },
  abandoned_recovery: {
    label: 'Sin seguimiento',
    tooltip: 'Clientes que recibieron un cupón de recuperación hace más de 48 horas pero no dejaron número de contacto. El cupón puede expirar.',
    Icon: Clock,
  },
  positive_spike: {
    label: 'Oportunidad Google',
    tooltip: '5 o más clientes muy satisfechos (5★) en las últimas 24 horas. Es el mejor momento para pedirles una reseña en Google.',
    Icon: TrendingUp,
  },
};

// ─── Severity config ──────────────────────────────────────────────────────────
const SEV = {
  critical: {
    color: T.red,   bg: T.red + '12',   label: 'CRÍTICO',
    tooltip: 'Requiere acción inmediata — el problema es severo y afecta múltiples clientes ahora mismo.',
  },
  high: {
    color: T.coral, bg: T.coral + '12', label: 'ALTO',
    tooltip: 'Problema importante que debe atenderse hoy para evitar que escale.',
  },
  medium: {
    color: T.amber, bg: T.amber + '12', label: 'MEDIO',
    tooltip: 'Situación a monitorear. No es urgente pero necesita atención esta semana.',
  },
  positive: {
    color: T.teal,  bg: T.teal + '12',  label: 'OPORTUNIDAD',
    tooltip: 'Momento favorable para amplificar la satisfacción del cliente hacia Google Reviews.',
  },
};

// ─── Detect alerts from feedbacks ────────────────────────────────────────────
function detectAlerts(feedbacks, locations, employeeQRs) {
  const alerts = [];
  const now = new Date();

  // 1. QUEJAS RECIENTES: 3+ bad scores at same location in last 24h
  locations.forEach(loc => {
    const recent = feedbacks.filter(f =>
      f.location_id === loc.id &&
      f.score <= 2 &&
      new Date(f.created_at) > subHours(now, 24)
    );
    if (recent.length >= 3) {
      const avg = (recent.reduce((s, f) => s + f.score, 0) / recent.length).toFixed(1);
      alerts.push({
        id: `quejas-${loc.id}`,
        type: 'quejas_recientes',
        severity: recent.length >= 5 ? 'critical' : 'high',
        title: 'Quejas recientes acumuladas',
        entity: loc.name,
        locationId: loc.id,
        entityType: 'location',
        detail: `${recent.length} calificaciones bajas en las últimas 24h · promedio ${avg}/5`,
        feedbacks: recent,
        tip: getRandomTip('quejas_recientes'),
        createdAt: recent[0]?.created_at,
      });
    }
  });

  // 2. EMPLEADO EN RIESGO
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
          title: 'Empleado con calificaciones bajas',
          entity: qr.label || 'Empleado sin nombre',
          locationId: qr.location_id,
          entityType: 'employee',
          entitySub: loc?.name,
          detail: `Promedio ${avg.toFixed(1)}/5 en ${weekFbs.length} calificaciones esta semana`,
          feedbacks: weekFbs,
          tip: getRandomTip('employee'),
          createdAt: weekFbs[0]?.created_at,
        });
      }
    }
  });

  // 3. BAJA SOSTENIDA
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
          title: 'Calificación en caída',
          entity: loc.name,
          locationId: loc.id,
          entityType: 'location',
          detail: `Bajó ${drop.toFixed(1)} pts vs semana pasada (${avgPrev.toFixed(1)} → ${avgLast.toFixed(1)})`,
          feedbacks: last7,
          tip: getRandomTip('trend'),
          createdAt: last7[0]?.created_at,
        });
      }
    }
  });

  // 4. SIN SEGUIMIENTO
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
      title: 'Clientes sin contacto posterior',
      entity: `${abandoned.length} clientes`,
      locationId: null,
      entityType: 'group',
      detail: 'Recibieron cupón pero no dejaron teléfono · sin seguimiento por más de 48h',
      feedbacks: abandoned,
      tip: getRandomTip('abandoned_recovery'),
      createdAt: abandoned[0]?.created_at,
    });
  }

  // 5. OPORTUNIDAD GOOGLE
  locations.forEach(loc => {
    const happy = feedbacks.filter(f =>
      f.location_id === loc.id &&
      f.score === 5 &&
      new Date(f.created_at) > subHours(now, 24)
    );
    if (happy.length >= 5) {
      alerts.push({
        id: `positive-${loc.id}`,
        type: 'positive_spike',
        severity: 'positive',
        title: 'Clientes muy satisfechos hoy',
        entity: loc.name,
        locationId: loc.id,
        entityType: 'location',
        detail: `${happy.length} calificaciones de 5★ en las últimas 24h — momento ideal para pedir reseña`,
        feedbacks: happy,
        tip: getRandomTip('positive_spike'),
        createdAt: happy[0]?.created_at,
      });
    }
  });

  const ORDER = { critical: 0, high: 1, medium: 2, positive: 3 };
  return alerts.sort((a, b) => (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9));
}

// ─── Location filter dropdown ─────────────────────────────────────────────────
function LocationFilter({ locations, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));
  const allSelected = selected.length === 0;
  const label = allSelected ? 'Todas las sucursales' : `${selected.length} sucursal${selected.length > 1 ? 'es' : ''}`;

  const toggle = id => {
    if (selected.includes(id)) onChange(selected.filter(x => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 12px', borderRadius: 10,
        border: `1.5px solid ${selected.length ? T.coral : T.border}`,
        background: selected.length ? T.coral + '08' : T.card,
        cursor: 'pointer', fontFamily: font, fontSize: '0.82rem', fontWeight: 600,
        color: selected.length ? T.coral : T.ink, whiteSpace: 'nowrap',
      }}>
        <MapPin size={13} />
        {label}
        <ChevronDown size={13} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
        {selected.length > 0 && (
          <span onClick={e => { e.stopPropagation(); onChange([]); }} style={{ marginLeft: 2, color: T.muted }}>
            <X size={11} />
          </span>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          background: T.card, borderRadius: 14, border: `1.5px solid ${T.border}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 240, maxWidth: 300,
        }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bg, borderRadius: 8, padding: '6px 10px' }}>
              <Search size={13} color={T.muted} />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar sucursal…"
                style={{ border: 'none', background: 'none', outline: 'none', fontFamily: font, fontSize: '0.82rem', color: T.ink, width: '100%' }}
              />
            </div>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', padding: '6px 0' }}>
            {filtered.map(loc => (
              <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', fontSize: '0.82rem', color: T.ink, fontFamily: font, fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={selected.includes(loc.id)}
                  onChange={() => toggle(loc.id)}
                  style={{ accentColor: T.coral, cursor: 'pointer' }}
                />
                {loc.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Alert card ───────────────────────────────────────────────────────────────
function AlertCard({ alert, onDismiss, onViewFeedbacks }) {
  const [actionDone, setActionDone] = useState(false);
  const sev = SEV[alert.severity] || SEV.medium;
  const meta = TYPE_META[alert.type] || TYPE_META.quejas_recientes;
  const Icon = meta.Icon;
  const isPositive = alert.type === 'positive_spike';
  const withPhone = alert.feedbacks.filter(f => f.contact_phone);

  const handleQuickAction = () => {
    if (isPositive) {
      withPhone.slice(0, 3).forEach((fb, i) => {
        setTimeout(() => {
          const msg = encodeURIComponent(`Hola, notamos que tuviste una gran experiencia con nosotros hoy 🌟 ¿Podrías compartir tu opinión en Google? Nos ayuda mucho.`);
          window.open(`https://wa.me/52${fb.contact_phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
        }, i * 400);
      });
    } else {
      const fb = withPhone[0];
      const msg = encodeURIComponent(`Hola, vimos que tu experiencia reciente no fue la mejor 😔 Queremos compensarte con un descuento especial. ¿Podemos ayudarte?`);
      window.open(`https://wa.me/52${fb.contact_phone.replace(/\D/g,'')}?text=${msg}`, '_blank');
    }
    setActionDone(true);
  };

  return (
    <div style={{
      background: T.card, borderRadius: 18,
      border: `2px solid ${sev.color}22`,
      overflow: 'hidden',
      boxShadow: alert.severity === 'critical' ? `0 4px 20px ${T.red}18` : isPositive ? `0 4px 20px ${T.teal}10` : 'none',
    }}>
      <div style={{ height: 3, background: sev.color, opacity: 0.7 }} />
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          {/* Icon */}
          <div style={{ width: 40, height: 40, borderRadius: 12, background: sev.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={18} color={sev.color} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badges row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
              {/* Severity badge with tooltip */}
              <Tooltip text={sev.tooltip}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: sev.color, background: sev.bg, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'default' }}>
                  {sev.label}
                </span>
              </Tooltip>
              {/* Type badge with tooltip */}
              <Tooltip text={meta.tooltip}>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: T.muted, background: T.bg, padding: '2px 8px', borderRadius: 999, border: `1px solid ${T.border}`, cursor: 'default' }}>
                  {meta.label}
                </span>
              </Tooltip>
              <span style={{ fontSize: '0.62rem', color: T.muted }}>
                {alert.createdAt ? format(new Date(alert.createdAt), "d MMM · HH:mm", { locale: es }) : ''}
              </span>
            </div>

            <div style={{ fontWeight: 800, color: T.ink, fontSize: '0.95rem', marginBottom: 2 }}>{alert.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontWeight: 700, color: sev.color, fontSize: '0.88rem' }}>{alert.entity}</span>
              {alert.entitySub && <span style={{ fontSize: '0.78rem', color: T.muted }}>· {alert.entitySub}</span>}
            </div>
            <div style={{ fontSize: '0.8rem', color: T.muted, marginTop: 4 }}>{alert.detail}</div>
          </div>

          <button onClick={() => onDismiss(alert.id)} title="Descartar alerta" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* AI Tip */}
        <Tooltip text="Sugerencia generada por Retelio basada en el patrón detectado. No es una instrucción obligatoria — úsala como punto de partida.">
          <div style={{ background: `linear-gradient(135deg, ${T.purple}08, ${T.teal}08)`, borderRadius: 10, padding: '10px 12px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'flex-start', border: `1px solid ${T.purple}18`, cursor: 'default', width: '100%' }}>
            <Zap size={13} color={T.purple} style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', color: T.ink, lineHeight: 1.5, fontStyle: 'italic' }}>{alert.tip}</span>
          </div>
        </Tooltip>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Tooltip text="Ver todos los comentarios y calificaciones asociadas a esta alerta">
            <button onClick={() => onViewFeedbacks(alert)} style={{
              padding: '7px 14px', borderRadius: 9, border: `1.5px solid ${T.border}`,
              background: 'none', cursor: 'pointer', fontFamily: font,
              fontSize: '0.78rem', fontWeight: 700, color: T.ink,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Eye size={13} /> Ver {alert.feedbacks.length} comentarios
            </button>
          </Tooltip>

          {withPhone.length > 0 && !actionDone && (
            <Tooltip text={isPositive
              ? `Enviar mensaje de WhatsApp a ${withPhone.length} cliente(s) satisfecho(s) pidiéndoles reseña en Google`
              : `Enviar mensaje de disculpa y compensación por WhatsApp al primer cliente con número registrado`}>
              <button onClick={handleQuickAction} style={{
                padding: '7px 14px', borderRadius: 9, border: 'none',
                background: isPositive ? T.teal + '15' : T.amber + '15',
                color: isPositive ? T.teal : T.amber,
                cursor: 'pointer', fontFamily: font, fontSize: '0.78rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {isPositive
                  ? <><ThumbsUp size={13} /> Pedir reseña ({withPhone.length})</>
                  : <><Send size={13} /> Recuperar por WhatsApp</>}
              </button>
            </Tooltip>
          )}

          {actionDone && (
            <span style={{ fontSize: '0.75rem', color: T.teal, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={13} /> Enviado
            </span>
          )}

          <Tooltip text="Marcar esta alerta como revisada. Desaparecerá de la lista de activas.">
            <button onClick={() => onDismiss(alert.id)} style={{
              padding: '7px 16px', borderRadius: 9, border: 'none',
              background: T.green, color: '#fff', cursor: 'pointer',
              fontFamily: font, fontSize: '0.78rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto',
            }}>
              <CheckCircle2 size={13} /> Marcar atendido
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

// ─── NPS category helper ──────────────────────────────────────────────────────
function npsCategory(score) {
  if (score === 5) return { label: 'Promotor',  color: T.teal  };
  if (score >= 3)  return { label: 'Pasivo',    color: T.amber };
  return               { label: 'Detractor', color: T.red   };
}

// ─── Recovery channels config ─────────────────────────────────────────────────
const CHANNELS = [
  { value: 'whatsapp',  label: 'WhatsApp',      Icon: MessageSquare, color: '#25D366' },
  { value: 'call',      label: 'Llamada',        Icon: Phone,         color: T.purple },
  { value: 'email',     label: 'Email',          Icon: Mail,          color: T.teal   },
  { value: 'in_person', label: 'En persona',     Icon: Users,         color: T.amber  },
  { value: 'other',     label: 'Otro',           Icon: FileText,      color: T.muted  },
];

// ─── Recovery status config ───────────────────────────────────────────────────
const REC_STATUS = {
  pending:   { label: 'Pendiente',  color: T.amber, bg: T.amber + '12' },
  contacted: { label: 'Contactado', color: T.coral, bg: T.coral + '12' },
  resolved:  { label: 'Resuelto',   color: T.green, bg: T.green + '12' },
  expired:   { label: 'Expirado',   color: T.muted, bg: T.muted + '12' },
};

// ─── Recovery lifecycle timeline ─────────────────────────────────────────────
function RecoveryTimeline({ fb }) {
  const hasCoupon   = !!fb.coupon_code;
  const contacted   = fb.recovery_status === 'contacted' || fb.recovery_status === 'resolved';
  const redeemed    = fb.coupon_redeemed;
  const resolved    = fb.recovery_status === 'resolved';
  const noReturn    = fb.coupon_not_returned;

  const ch = CHANNELS.find(c => c.value === fb.recovery_channel);

  const steps = [
    {
      icon: '🎟',
      label: hasCoupon ? 'Cupón generado' : 'Feedback recibido',
      sub: hasCoupon ? `Código: ${fb.coupon_code} · enviado automáticamente` : 'Sin cupón automático',
      done: true,
      color: T.teal,
    },
    {
      icon: ch ? null : '💬',
      IconComp: ch?.Icon,
      iconColor: ch?.color,
      label: contacted ? `Contactado via ${ch?.label || 'mensaje'}` : 'Contactar al cliente',
      sub: contacted && fb.recovery_at
        ? `${format(new Date(fb.recovery_at), "d MMM · HH:mm", { locale: es })} · por ${fb.recovery_actor || '—'}`
        : 'Enviar mensaje personalizado con el cupón',
      done: contacted,
      color: contacted ? T.coral : T.muted,
    },
    {
      icon: redeemed ? '✅' : noReturn ? '❌' : '🏪',
      label: redeemed ? 'Canjeó el cupón' : noReturn ? 'No regresó' : 'Validar en caja',
      sub: redeemed
        ? `Validado por ${fb.coupon_redeemed_by || '—'} · ${fb.coupon_redeemed_at ? format(new Date(fb.coupon_redeemed_at), "d MMM · HH:mm", { locale: es }) : ''}`
        : noReturn
          ? 'Cliente no se presentó'
          : 'El cliente llega con el cupón, el staff lo valida',
      done: redeemed,
      failed: noReturn,
      color: redeemed ? T.green : noReturn ? T.muted : T.muted,
    },
    {
      icon: '⭐',
      label: resolved ? 'Cliente recuperado' : 'Recuperación completa',
      sub: resolved ? 'Ciclo cerrado exitosamente' : 'Objetivo final: cliente satisfecho',
      done: resolved,
      color: resolved ? T.green : T.muted,
    },
  ];

  return (
    <div style={{ marginTop: 12, padding: '12px 14px', background: T.bg, borderRadius: 12, border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Ciclo de recuperación</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingBottom: i < steps.length - 1 ? 10 : 0 }}>
            {/* Line + dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: s.done ? s.color + '18' : s.failed ? T.muted + '10' : T.bg,
                border: `2px solid ${s.done ? s.color : s.failed ? T.muted + '40' : T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: s.IconComp ? undefined : '0.75rem',
              }}>
                {s.IconComp
                  ? <s.IconComp size={12} color={s.done ? s.iconColor : T.muted} />
                  : <span>{s.icon}</span>}
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: 2, flex: 1, minHeight: 10, background: s.done ? s.color + '30' : T.border, margin: '2px 0' }} />
              )}
            </div>
            {/* Content */}
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: s.done ? T.ink : s.failed ? T.muted : T.muted }}>{s.label}</div>
              <div style={{ fontSize: '0.68rem', color: T.muted, lineHeight: 1.4 }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Daily validation panel ───────────────────────────────────────────────────
function DailyValidationPanel({ feedbacks, locations, tenant, userEmail, onFeedbackUpdate, onClose }) {
  const [saving, setSaving] = useState(null); // feedback id being saved
  const [filter, setFilter] = useState('pending'); // pending | all

  // Feedbacks that were contacted and have a coupon pending validation
  const contactedWithCoupon = feedbacks.filter(f =>
    f.recovery_status === 'contacted' &&
    f.coupon_code &&
    !f.coupon_redeemed &&
    !f.coupon_not_returned
  );

  const grouped = useMemo(() => {
    const map = {};
    contactedWithCoupon.forEach(fb => {
      const loc = locations.find(l => l.id === fb.location_id);
      const key = loc?.name || 'Sin sucursal';
      if (!map[key]) map[key] = [];
      map[key].push(fb);
    });
    return map;
  }, [contactedWithCoupon, locations]);

  const markRedeemed = async (fb) => {
    setSaving(fb.id);
    const now = new Date().toISOString();
    const update = {
      coupon_redeemed: true,
      coupon_redeemed_at: now,
      coupon_redeemed_by: userEmail,
      recovery_status: 'resolved',
      recovery_resolved_at: now,
    };
    await supabase.from('feedbacks').update(update).eq('id', fb.id).eq('tenant_id', tenant.id);
    onFeedbackUpdate({ ...fb, ...update });
    setSaving(null);
  };

  const markNotReturned = async (fb) => {
    setSaving(fb.id + '_no');
    const update = { coupon_not_returned: true };
    await supabase.from('feedbacks').update(update).eq('id', fb.id).eq('tenant_id', tenant.id);
    onFeedbackUpdate({ ...fb, ...update });
    setSaving(null);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: T.card, borderRadius: 24, width: '100%', maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <h2 style={{ fontWeight: 800, color: T.ink, fontSize: '1.1rem' }}>Validar recuperaciones de hoy</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}><X size={20} /></button>
          </div>
          <p style={{ fontSize: '0.82rem', color: T.muted }}>
            Marca qué clientes llegaron con su cupón. Al final del turno o del día.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 14px', borderRadius: 12, background: T.amber + '12', border: `1px solid ${T.amber}30` }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: T.amber, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Por validar</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: T.amber }}>{contactedWithCoupon.length}</div>
            </div>
            <div style={{ padding: '8px 14px', borderRadius: 12, background: T.green + '12', border: `1px solid ${T.green}30` }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: T.green, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ya canjeados hoy</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: T.green }}>
                {feedbacks.filter(f => f.coupon_redeemed && f.coupon_redeemed_at && new Date(f.coupon_redeemed_at) > subHours(new Date(), 24)).length}
              </div>
            </div>
            <div style={{ padding: '8px 14px', borderRadius: 12, background: T.muted + '10', border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tasa recuperación</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: T.ink }}>
                {(() => {
                  const total = feedbacks.filter(f => f.recovery_status === 'contacted').length;
                  const redeemed = feedbacks.filter(f => f.coupon_redeemed).length;
                  return total ? `${Math.round(redeemed / total * 100)}%` : '—';
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {contactedWithCoupon.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎉</div>
              <div style={{ fontWeight: 700, color: T.ink, marginBottom: 6 }}>¡Todo validado!</div>
              <div style={{ fontSize: '0.85rem', color: T.muted }}>No hay cupones pendientes de confirmar en este momento.</div>
            </div>
          ) : (
            Object.entries(grouped).map(([locName, fbs]) => (
              <div key={locName} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={11} /> {locName} · {fbs.length} pendiente{fbs.length > 1 ? 's' : ''}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {fbs.map(fb => {
                    const cat = npsCategory(fb.score);
                    const isSavingRedeem = saving === fb.id;
                    const isSavingNo     = saving === fb.id + '_no';
                    return (
                      <div key={fb.id} style={{
                        background: T.bg, borderRadius: 14, padding: '14px 16px',
                        border: `1.5px solid ${T.border}`,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        {/* Score */}
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: cat.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: cat.color, fontSize: '1rem', flexShrink: 0 }}>
                          {fb.score}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: T.ink, fontSize: '0.85rem', marginBottom: 2 }}>
                            🎟 {fb.coupon_code}
                          </div>
                          {fb.comment && (
                            <div style={{ fontSize: '0.75rem', color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              "{fb.comment}"
                            </div>
                          )}
                          <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: 2 }}>
                            Contactado {fb.recovery_at ? formatDistanceToNow(new Date(fb.recovery_at), { locale: es, addSuffix: true }) : ''}
                            {fb.recovery_channel && ` · via ${CHANNELS.find(c => c.value === fb.recovery_channel)?.label || fb.recovery_channel}`}
                          </div>
                        </div>
                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <Tooltip text="El cliente llegó y mostró el cupón">
                            <button onClick={() => markRedeemed(fb)} disabled={!!saving} style={{
                              padding: '8px 12px', borderRadius: 10, border: 'none',
                              background: T.green, color: '#fff', fontFamily: font,
                              fontSize: '0.75rem', fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: 5, opacity: isSavingNo ? 0.5 : 1,
                            }}>
                              {isSavingRedeem ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={13} />}
                              Canjeó
                            </button>
                          </Tooltip>
                          <Tooltip text="El cliente fue contactado pero no regresó">
                            <button onClick={() => markNotReturned(fb)} disabled={!!saving} style={{
                              padding: '8px 10px', borderRadius: 10, border: `1.5px solid ${T.border}`,
                              background: 'none', color: T.muted, fontFamily: font,
                              fontSize: '0.75rem', fontWeight: 600, cursor: saving ? 'default' : 'pointer',
                              opacity: isSavingRedeem ? 0.5 : 1,
                            }}>
                              {isSavingNo ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : '✗'}
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Recovery flow for an individual feedback ─────────────────────────────────
function RecoveryFlow({ fb, isPositive, tenant, userEmail, onUpdate }) {
  const alreadyActed = isPositive ? fb.routed_to_google : (fb.recovery_status && fb.recovery_status !== 'pending');
  const [step, setStep]         = useState('idle');    // idle | form | whatsapp_confirm | resolve | done
  const [channel, setChannel]   = useState(fb.contact_phone ? 'whatsapp' : 'in_person');
  const [saving, setSaving]     = useState(false);
  const [waOpened, setWaOpened] = useState(false);

  const defaultMsg = isPositive
    ? fb.comment
      ? `Hola, vimos que mencionaste "${fb.comment.slice(0, 60)}${fb.comment.length > 60 ? '…' : ''}" — ¡nos alegra mucho! 🌟 ¿Nos ayudarías compartiendo tu experiencia en Google? Solo toma un minuto y significa mucho para nuestro equipo. ¡Gracias!`
      : `Hola, notamos que tuviste una gran experiencia con nosotros hoy 🌟 ¿Nos ayudarías compartiendo tu opinión en Google? Solo toma un minuto. ¡Gracias!`
    : fb.comment
      ? `Hola, vimos que mencionaste "${fb.comment.slice(0, 80)}${fb.comment.length > 80 ? '…' : ''}" 😔 Nos importa mucho tu experiencia y queremos mejorar. ¿Podemos compensarte con un beneficio especial en tu próxima visita? Estamos aquí para ayudarte.`
      : `Hola, notamos que tu experiencia reciente no fue la que esperabas 😔 Nos importa mucho tu satisfacción. ¿Podemos hacer algo para compensarte? Estamos aquí para ayudarte.`;

  const defaultNote = isPositive
    ? fb.comment
      ? `Cliente satisfecho. Comentó: "${fb.comment.slice(0, 80)}". Se solicitará reseña en Google.`
      : `Cliente con calificación máxima. Se solicitará reseña en Google.`
    : fb.score === 1
      ? fb.comment
        ? `Experiencia muy negativa. Cliente mencionó: "${fb.comment.slice(0, 80)}". Contactar para ofrecer compensación y entender la causa raíz.`
        : `Calificación mínima (1/5). Contactar para ofrecer compensación y entender qué falló.`
      : fb.comment
        ? `Experiencia por debajo de expectativas. Cliente mencionó: "${fb.comment.slice(0, 80)}". Contactar para reconectar y ofrecer beneficio.`
        : `Calificación baja (${fb.score}/5). Contactar para entender qué mejorar y reconectar.`;

  const [message, setMessage] = useState(defaultMsg);
  const [note, setNote]       = useState(defaultNote);

  const [sendError, setSendError] = useState('');

  // Platform-sent message via Edge Function (Twilio)
  const platformSend = async () => {
    setSaving(true);
    setSendError('');
    try {
      const { data, error } = await supabase.functions.invoke('send-recovery-message', {
        body: {
          feedback_id:  fb.id,
          tenant_id:    tenant.id,
          phone:        fb.contact_phone,
          message,
          channel,
          note,
          actor_email:  userEmail,
        },
      });
      if (error || !data?.ok) {
        const msg = data?.error || error?.message || 'Error desconocido';
        setSendError(msg);
        setSaving(false);
        return;
      }
      // Success: feedback already updated by Edge Function, update local state
      const now = new Date().toISOString();
      onUpdate({
        ...fb,
        recovery_status:  'contacted',
        recovery_channel: channel,
        recovery_note:    note,
        recovery_actor:   userEmail,
        recovery_at:      now,
        recovery_sent:    true,
      });
      setStep('done');
    } catch (e) {
      setSendError(String(e));
    }
    setSaving(false);
  };

  const saveAction = async (status, extraFields = {}) => {
    setSaving(true);
    const now = new Date().toISOString();
    const update = isPositive
      ? { routed_to_google: true, google_note: note, google_actor: userEmail, google_at: now, ...extraFields }
      : { recovery_status: status, recovery_channel: channel, recovery_note: note, recovery_actor: userEmail, recovery_at: now, recovery_sent: true, ...extraFields };
    await supabase.from('feedbacks').update(update).eq('id', fb.id).eq('tenant_id', tenant.id);
    onUpdate({ ...fb, ...update });
    setSaving(false);
    setStep('done');
  };

  // Fallback: open WhatsApp manually (used when Twilio fails or for positive/google flow)
  const openWhatsApp = () => {
    window.open(`https://wa.me/52${fb.contact_phone.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`, '_blank');
    setWaOpened(true);
    setStep('whatsapp_confirm');
  };

  // ── Already acted ──
  if (alreadyActed || step === 'done') {
    const status = isPositive ? null : fb.recovery_status;
    const cfg = status ? REC_STATUS[status] : null;
    const actorNote = isPositive ? fb.google_note : fb.recovery_note;
    const actorEmail = isPositive ? fb.google_actor : fb.recovery_actor;
    const actorAt = isPositive ? fb.google_at : fb.recovery_at;
    const ch = CHANNELS.find(c => c.value === fb.recovery_channel);
    return (
      <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: T.bg, border: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: cfg && status !== 'resolved' ? 6 : 0 }}>
          {cfg ? (
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 999 }}>{cfg.label}</span>
          ) : (
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: T.teal, background: T.teal + '12', padding: '2px 8px', borderRadius: 999 }}>Reseña solicitada</span>
          )}
          {ch && <span style={{ fontSize: '0.68rem', color: ch.color, fontWeight: 600 }}>via {ch.label}</span>}
          {actorAt && <span style={{ fontSize: '0.65rem', color: T.muted }}>{format(new Date(actorAt), "d MMM · HH:mm", { locale: es })}</span>}
        </div>
        {actorNote && <div style={{ fontSize: '0.75rem', color: T.muted, fontStyle: 'italic', marginBottom: 4 }}>"{actorNote}"</div>}
        {actorEmail && <div style={{ fontSize: '0.68rem', color: T.muted }}>Por: {actorEmail}</div>}
        {/* Allow marking as resolved if contacted */}
        {status === 'contacted' && (
          <button onClick={() => setStep('resolve')} style={{
            marginTop: 8, padding: '5px 10px', borderRadius: 8, border: `1px solid ${T.green}40`,
            background: 'none', color: T.green, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: font,
          }}>
            Marcar como resuelto →
          </button>
        )}
        {step === 'resolve' && (
          <div style={{ marginTop: 8 }}>
            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="¿Cómo se resolvió? Ej: El cliente aceptó el cupón y regresó."
              rows={2}
              style={{ width: '100%', borderRadius: 8, border: `1.5px solid ${T.border}`, padding: '8px 10px', fontFamily: font, fontSize: '0.78rem', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
            <button onClick={() => saveAction('resolved', { recovery_resolved_at: new Date().toISOString() })}
              disabled={note.trim().length < 10 || saving}
              style={{ marginTop: 6, padding: '6px 14px', borderRadius: 8, border: 'none', background: note.trim().length >= 10 ? T.green : T.border, color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: note.trim().length >= 10 ? 'pointer' : 'default', fontFamily: font }}>
              {saving ? 'Guardando…' : 'Confirmar resolución'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Idle: show action button with available channel chip ──
  if (step === 'idle') {
    const availableCh = fb.contact_phone
      ? CHANNELS.find(c => c.value === 'whatsapp')
      : fb.contact_email
        ? CHANNELS.find(c => c.value === 'email')
        : null;

    return (
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Available channel chip */}
        {availableCh ? (
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: availableCh.color, background: availableCh.color + '12', padding: '3px 8px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4 }}>
            <availableCh.Icon size={10} />
            {availableCh.label} disponible
          </span>
        ) : !isPositive && (
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: T.muted, background: T.muted + '10', padding: '3px 8px', borderRadius: 999 }}>
            Sin datos de contacto
          </span>
        )}
        <button onClick={() => setStep('form')} style={{
          padding: '7px 14px', borderRadius: 9,
          border: `1.5px solid ${isPositive ? T.teal : T.coral}`,
          background: 'none', color: isPositive ? T.teal : T.coral,
          fontFamily: font, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {isPositive ? <><ThumbsUp size={13} /> Solicitar reseña Google</> : <><Send size={13} /> Iniciar recuperación</>}
        </button>
      </div>
    );
  }

  // ── Form: channel + message + required note ──
  if (step === 'form') {
    return (
      <div style={{ marginTop: 10, background: T.bg, borderRadius: 12, padding: 14, border: `1.5px solid ${T.border}` }}>
        {/* Channel selector */}
        {!isPositive && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Canal de contacto</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CHANNELS.map(ch => {
                const active = channel === ch.value;
                return (
                  <button key={ch.value} onClick={() => setChannel(ch.value)} style={{
                    padding: '5px 10px', borderRadius: 8,
                    border: `1.5px solid ${active ? ch.color : T.border}`,
                    background: active ? ch.color + '15' : 'none',
                    color: active ? ch.color : T.muted,
                    fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: font,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <ch.Icon size={11} /> {ch.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Message (editable, shown for WhatsApp/Email) */}
        {(channel === 'whatsapp' || channel === 'email' || isPositive) && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Mensaje {channel === 'whatsapp' ? '(se enviará por WhatsApp)' : channel === 'email' ? '(se enviará por email)' : ''}
            </div>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              rows={3}
              style={{ width: '100%', borderRadius: 8, border: `1.5px solid ${T.border}`, padding: '8px 10px', fontFamily: font, fontSize: '0.78rem', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
            />
          </div>
        )}

        {/* Required note */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
            Nota de acción <span style={{ color: T.coral }}>*</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: T.muted, marginBottom: 6 }}>
            Documenta qué harás o qué pasó. Queda registrado con tu nombre y la hora.
          </div>
          <textarea
            value={note} onChange={e => setNote(e.target.value)}
            placeholder={isPositive
              ? 'Ej: Cliente muy feliz con la atención de Maria, se le pidió reseña y aceptó.'
              : 'Ej: Cliente insatisfecho con espera, se le ofrecerá 20% descuento en próxima visita.'}
            rows={2}
            style={{ width: '100%', borderRadius: 8, border: `1.5px solid ${note.trim().length > 0 && note.trim().length < 15 ? T.coral : T.border}`, padding: '8px 10px', fontFamily: font, fontSize: '0.78rem', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
          />
          {note.trim().length > 0 && note.trim().length < 15 && (
            <div style={{ fontSize: '0.65rem', color: T.coral, marginTop: 3 }}>Mínimo 15 caracteres para garantizar trazabilidad</div>
          )}
        </div>

        {/* Error message */}
        {sendError && (
          <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: T.red + '10', border: `1px solid ${T.red}30`, fontSize: '0.75rem', color: T.red, lineHeight: 1.4 }}>
            <strong>Error al enviar:</strong> {sendError}
            {fb.contact_phone && (
              <button onClick={openWhatsApp} style={{ display: 'block', marginTop: 6, padding: '4px 10px', borderRadius: 7, border: `1px solid ${T.red}30`, background: 'none', color: T.red, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                Enviar manualmente por WhatsApp →
              </button>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Platform sends via Twilio when channel is whatsapp/sms and phone available */}
          {(channel === 'whatsapp' || channel === 'sms') && fb.contact_phone ? (
            <button onClick={platformSend} disabled={note.trim().length < 15 || saving}
              style={{
                padding: '8px 16px', borderRadius: 9, border: 'none',
                background: note.trim().length >= 15 ? (channel === 'whatsapp' ? '#25D366' : T.purple) : T.border,
                color: '#fff', fontFamily: font, fontSize: '0.78rem', fontWeight: 700,
                cursor: note.trim().length >= 15 ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: 6,
                opacity: saving ? 0.7 : 1,
              }}>
              {saving
                ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Enviando…</>
                : <><Send size={13} /> Enviar {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} ahora</>}
            </button>
          ) : isPositive && fb.contact_phone ? (
            <button onClick={openWhatsApp} disabled={note.trim().length < 15}
              style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: note.trim().length >= 15 ? T.teal : T.border, color: '#fff', fontFamily: font, fontSize: '0.78rem', fontWeight: 700, cursor: note.trim().length >= 15 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ExternalLink size={13} /> Abrir WhatsApp
            </button>
          ) : (
            <button onClick={() => saveAction(isPositive ? null : 'contacted')}
              disabled={note.trim().length < 15 || saving}
              style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: note.trim().length >= 15 ? (isPositive ? T.teal : T.coral) : T.border, color: '#fff', fontFamily: font, fontSize: '0.78rem', fontWeight: 700, cursor: note.trim().length >= 15 ? 'pointer' : 'default' }}>
              {saving ? 'Guardando…' : 'Registrar acción'}
            </button>
          )}
          <button onClick={() => { setStep('idle'); setSendError(''); }} style={{ padding: '7px 12px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'none', color: T.muted, fontFamily: font, fontSize: '0.78rem', cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ── WhatsApp confirm: force user to confirm they actually sent it ──
  if (step === 'whatsapp_confirm') {
    return (
      <div style={{ marginTop: 10, background: '#25D36608', borderRadius: 12, padding: 14, border: `1.5px solid #25D36630` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
          <AlertCircle size={16} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: '0.8rem', color: T.ink, lineHeight: 1.5 }}>
            <strong>¿Enviaste el mensaje?</strong> Confirmarlo registra la acción con tu nombre, la hora y la nota. Sin confirmación, no queda rastro.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => saveAction(isPositive ? null : 'contacted')}
            disabled={saving}
            style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: T.green, color: '#fff', fontFamily: font, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ClipboardCheck size={13} /> {saving ? 'Registrando…' : 'Sí, lo envié'}
          </button>
          <button onClick={openWhatsApp} style={{ padding: '7px 12px', borderRadius: 9, border: `1px solid #25D36640`, background: 'none', color: '#25D366', fontFamily: font, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ExternalLink size={12} /> Abrir de nuevo
          </button>
          <button onClick={() => setStep('form')} style={{ padding: '7px 12px', borderRadius: 9, border: `1px solid ${T.border}`, background: 'none', color: T.muted, fontFamily: font, fontSize: '0.78rem', cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Feedback detail + action panel ──────────────────────────────────────────
function FeedbackPanel({ alert, locations, tenant, userEmail, onClose, onFeedbackUpdate }) {
  const [fbs, setFbs] = useState(alert.feedbacks);
  if (!alert) return null;

  const handleUpdate = updated => {
    setFbs(prev => prev.map(f => f.id === updated.id ? updated : f));
    onFeedbackUpdate?.(updated);
  };

  const sev = SEV[alert.severity] || SEV.medium;
  const meta = TYPE_META[alert.type] || TYPE_META.quejas_recientes;
  const isPositive = alert.type === 'positive_spike';

  const actioned = fbs.filter(f =>
    isPositive ? f.routed_to_google : (f.recovery_status && f.recovery_status !== 'pending')
  ).length;
  const withPhone = fbs.filter(f => f.contact_phone).length;
  const pending = fbs.length - actioned;

  // SLA: oldest unactioned feedback
  const oldestPending = fbs
    .filter(f => !isPositive && (!f.recovery_status || f.recovery_status === 'pending'))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
  const slaHours = oldestPending
    ? Math.round((Date.now() - new Date(oldestPending.created_at)) / 3600000)
    : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: T.card, width: '100%', maxWidth: 520, height: '100vh', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: sev.color, background: sev.bg, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{sev.label}</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: T.muted, background: T.bg, padding: '2px 8px', borderRadius: 999, border: `1px solid ${T.border}` }}>{meta.label}</span>
              </div>
              <h3 style={{ fontWeight: 800, color: T.ink, fontSize: '1.05rem', marginBottom: 2 }}>{alert.entity}</h3>
              <p style={{ fontSize: '0.78rem', color: T.muted }}>{alert.detail}</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, flexShrink: 0, marginTop: 4 }}><X size={20} /></button>
          </div>

          {/* Progress strip */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: T.muted, fontWeight: 600 }}>
              <strong style={{ color: T.ink }}>{fbs.length}</strong> comentarios
            </span>
            {withPhone > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#25D366', fontWeight: 600 }}>
                <MessageSquare size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                {withPhone} con teléfono
              </span>
            )}
            {actioned > 0 && (
              <span style={{ fontSize: '0.75rem', color: T.green, fontWeight: 700 }}>
                <CheckCircle2 size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                {actioned} atendidos
              </span>
            )}
            {pending > 0 && !isPositive && (
              <span style={{ fontSize: '0.75rem', color: T.amber, fontWeight: 700 }}>
                <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                {pending} pendientes
              </span>
            )}
          </div>

          {/* SLA warning */}
          {slaHours !== null && slaHours > 4 && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: slaHours > 24 ? T.red + '10' : T.amber + '10', border: `1px solid ${slaHours > 24 ? T.red + '30' : T.amber + '30'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} color={slaHours > 24 ? T.red : T.amber} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: slaHours > 24 ? T.red : T.amber }}>
                {slaHours > 24
                  ? `Lleva más de ${Math.round(slaHours / 24)} días sin atención — riesgo de perder al cliente`
                  : `Sin atender hace ${slaHours}h — actúa antes de que el cliente publique en redes`}
              </span>
            </div>
          )}
        </div>

        {/* Feedback list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {fbs.map(fb => {
            const loc = locations.find(l => l.id === fb.location_id);
            const cat = npsCategory(fb.score);
            const recStatus = isPositive ? (fb.routed_to_google ? 'resolved' : 'pending') : (fb.recovery_status || 'pending');
            const recCfg = REC_STATUS[recStatus] || REC_STATUS.pending;
            const isActioned = recStatus !== 'pending';
            return (
              <div key={fb.id} style={{
                background: isActioned ? T.bg : T.card,
                borderRadius: 16, padding: '14px 16px',
                border: `1.5px solid ${isActioned ? T.teal + '25' : T.border}`,
              }}>
                {/* Score + meta */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 11,
                    background: cat.color + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, color: cat.color, fontSize: '1.05rem', flexShrink: 0,
                  }}>
                    {fb.score}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: cat.color, background: cat.color + '12', padding: '1px 7px', borderRadius: 999 }}>{cat.label}</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: recCfg.color, background: recCfg.bg, padding: '1px 7px', borderRadius: 999 }}>{recCfg.label}</span>
                      {fb.contact_phone && (
                        <span style={{ fontSize: '0.65rem', color: '#25D366', background: '#25D36612', padding: '1px 7px', borderRadius: 999, fontWeight: 700 }}>📱 WhatsApp</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: T.muted }}>
                      {loc?.name && <span style={{ fontWeight: 600, color: T.ink }}>{loc.name} · </span>}
                      {format(new Date(fb.created_at), "d MMM yyyy · HH:mm", { locale: es })}
                      {' · '}
                      <span style={{ color: slaHours > 24 && !isActioned ? T.red : T.muted }}>
                        {formatDistanceToNow(new Date(fb.created_at), { locale: es, addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>

                {fb.comment && (
                  <div style={{ fontSize: '0.83rem', color: T.ink, lineHeight: 1.55, marginBottom: 6 }}>
                    "{fb.comment}"
                  </div>
                )}
                {fb.followup_answer && (
                  <div style={{ fontSize: '0.76rem', color: T.purple, marginBottom: 6 }}>↳ {fb.followup_answer}</div>
                )}
                {fb.coupon_code && (
                  <div style={{ fontSize: '0.72rem', color: T.amber, fontWeight: 700, marginBottom: 6 }}>
                    🎟 Cupón enviado: {fb.coupon_code}
                  </div>
                )}

                {/* Recovery lifecycle timeline */}
                {!isPositive && (fb.coupon_code || fb.recovery_status) && (
                  <RecoveryTimeline fb={fb} />
                )}

                {/* Recovery flow action */}
                {tenant && (
                  <RecoveryFlow
                    fb={fb}
                    isPositive={isPositive}
                    tenant={tenant}
                    userEmail={userEmail}
                    onUpdate={handleUpdate}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Stat card with tooltip ───────────────────────────────────────────────────
function StatCard({ label, value, color, Icon, tooltip }) {
  return (
    <div style={{ background: T.card, borderRadius: 16, padding: '16px 20px', border: `1.5px solid ${T.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
        <Tooltip text={tooltip}>
          <Info size={11} color={T.muted} style={{ cursor: 'default', marginLeft: 2 }} />
        </Tooltip>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function IssueManagement() {
  const { tenant } = useTenant();
  const [userEmail, setUserEmail]       = useState('');
  const [feedbacks, setFeedbacks]       = useState([]);
  const [locations, setLocations]       = useState([]);
  const [employeeQRs, setEmployeeQRs]   = useState([]);
  const [dismissed, setDismissed]       = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('retelio_dismissed_alerts') || '[]')); }
    catch { return new Set(); }
  });
  const [loading, setLoading]               = useState(true);
  const [activePanel, setActivePanel]       = useState(null);
  const [showDailyValidation, setShowDailyValidation] = useState(false);
  const [tab, setTab]                       = useState('active');
  const [selectedLocs, setSelectedLocs]     = useState([]);
  const [typeFilter, setTypeFilter]         = useState('all');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  useEffect(() => { if (tenant?.id) loadData(); }, [tenant?.id]);

  const loadData = async () => {
    setLoading(true);
    const since = subDays(new Date(), 30).toISOString();
    const [fbRes, locRes, locRes2, qrRes] = await Promise.all([
      supabase.from('feedbacks')
        .select('id, location_id, tienda_id, qr_id, score, comment, followup_answer, recovery_sent, routed_to_google, coupon_code, contact_phone, contact_email, created_at, recovery_status, recovery_channel, recovery_note, recovery_actor, recovery_at, recovery_resolved_at, coupon_redeemed, coupon_redeemed_at, coupon_redeemed_by, coupon_not_returned, google_note, google_actor, google_at')
        .eq('tenant_id', tenant.id)
        .eq('is_test', tenant.test_mode === true)
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      supabase.from('Tiendas_Catalogo').select('id, name:nombre').eq('tenant_id', tenant.id),
      supabase.from('locations').select('id, name').eq('tenant_id', tenant.id),
      supabase.from('qr_codes').select('id, label, location_id, type').eq('tenant_id', tenant.id).eq('type', 'employee'),
    ]);
    // Normalize feedbacks: use location_id (new schema) falling back to tienda_id (legacy)
    const normalizedFbs = (fbRes.data || []).map(f => ({
      ...f,
      location_id: f.location_id || f.tienda_id,
    }));
    // Merge locations from both schemas (deduplicate by id)
    const allLocs = [...(locRes.data || []), ...(locRes2.data || [])];
    const uniqueLocs = Object.values(Object.fromEntries(allLocs.map(l => [l.id, l])));
    setFeedbacks(normalizedFbs);
    setLocations(uniqueLocs);
    if (qrRes.data) setEmployeeQRs(qrRes.data);
    setLoading(false);
  };

  const allAlerts = useMemo(() => detectAlerts(feedbacks, locations, employeeQRs), [feedbacks, locations, employeeQRs]);

  const filteredAlerts = useMemo(() => {
    let list = allAlerts.filter(a => !dismissed.has(a.id));
    if (selectedLocs.length > 0) {
      list = list.filter(a => !a.locationId || selectedLocs.includes(a.locationId));
    }
    if (typeFilter !== 'all') {
      list = list.filter(a => a.type === typeFilter);
    }
    return list;
  }, [allAlerts, dismissed, selectedLocs, typeFilter]);

  const resolvedCount = dismissed.size;

  const dismiss = id => {
    const next = new Set([...dismissed, id]);
    setDismissed(next);
    localStorage.setItem('retelio_dismissed_alerts', JSON.stringify([...next]));
  };

  const stats = useMemo(() => ({
    activeCount: allAlerts.filter(a => !dismissed.has(a.id)).length,
    unhappy24h: feedbacks.filter(f => f.score <= 2 && new Date(f.created_at) > subHours(new Date(), 24)).length,
    opportunities: allAlerts.filter(a => a.type === 'positive_spike').length,
  }), [feedbacks, allAlerts, dismissed]);

  const availableTypes = useMemo(() => {
    const types = new Set(allAlerts.filter(a => !dismissed.has(a.id)).map(a => a.type));
    return [...types];
  }, [allAlerts, dismissed]);

  const showLocationFilter = locations.length > 1;

  return (
    <div style={{ fontFamily: font, padding: 28, background: T.bg, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 4 }}>Centro de Alertas</h1>
          <p style={{ fontSize: '0.85rem', color: T.muted }}>
            Retelio detecta automáticamente problemas y oportunidades · últimos 30 días
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Daily validation button — shows count badge if there are pending */}
          {(() => {
            const pending = feedbacks.filter(f =>
              f.recovery_status === 'contacted' && f.coupon_code && !f.coupon_redeemed && !f.coupon_not_returned
            ).length;
            return pending > 0 ? (
              <button onClick={() => setShowDailyValidation(true)} style={{
                padding: '8px 14px', borderRadius: 10, border: 'none',
                background: T.amber, color: '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: font, fontSize: '0.8rem', fontWeight: 700,
              }}>
                <ClipboardCheck size={14} /> Validar cupones
                <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 999, padding: '0 6px', fontSize: '0.72rem', fontWeight: 800 }}>{pending}</span>
              </button>
            ) : null;
          })()}
          <Tooltip text="Volver a analizar los datos más recientes">
            <button onClick={loadData} style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.card, cursor: 'pointer', color: T.muted, display: 'flex', alignItems: 'center', gap: 6, fontFamily: font, fontSize: '0.8rem', fontWeight: 600 }}>
              <RefreshCw size={14} /> Actualizar
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard
          label="Alertas activas"
          value={stats.activeCount}
          color={stats.activeCount > 0 ? T.coral : T.green}
          Icon={AlertTriangle}
          tooltip="Número de patrones negativos detectados que aún no han sido atendidos."
        />
        <StatCard
          label="Negativos últimas 24h"
          value={stats.unhappy24h}
          color={stats.unhappy24h > 0 ? T.red : T.green}
          Icon={TrendingDown}
          tooltip="Calificaciones de 1 o 2 estrellas recibidas en las últimas 24 horas en todas tus sucursales."
        />
        <StatCard
          label="Oportunidades Google"
          value={stats.opportunities}
          color={stats.opportunities > 0 ? T.teal : T.muted}
          Icon={TrendingUp}
          tooltip="Sucursales con 5 o más clientes muy satisfechos hoy. Es el mejor momento para pedirles una reseña en Google."
        />
      </div>

      {/* Tabs + Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 12, padding: 4 }}>
          {[
            ['active', `Activas (${stats.activeCount})`],
            ['resolved', `Atendidas (${resolvedCount})`],
          ].map(([val, label]) => (
            <button key={val} onClick={() => setTab(val)} style={{
              padding: '7px 18px', borderRadius: 9, border: 'none',
              background: tab === val ? T.ink : 'transparent',
              color: tab === val ? '#fff' : T.muted,
              fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', fontFamily: font,
            }}>{label}</button>
          ))}
        </div>

        {showLocationFilter && tab === 'active' && (
          <LocationFilter locations={locations} selected={selectedLocs} onChange={setSelectedLocs} />
        )}

        {tab === 'active' && availableTypes.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setTypeFilter('all')} style={{
              padding: '6px 12px', borderRadius: 20,
              border: `1.5px solid ${typeFilter === 'all' ? T.ink : T.border}`,
              background: typeFilter === 'all' ? T.ink : 'transparent',
              color: typeFilter === 'all' ? '#fff' : T.muted,
              fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: font,
            }}>Todos</button>
            {availableTypes.map(type => {
              const active = typeFilter === type;
              const meta = TYPE_META[type];
              if (!meta) return null;
              const sev = allAlerts.find(a => a.type === type);
              const color = sev ? (SEV[sev.severity]?.color || T.ink) : T.ink;
              return (
                <Tooltip key={type} text={meta.tooltip}>
                  <button onClick={() => setTypeFilter(active ? 'all' : type)} style={{
                    padding: '6px 12px', borderRadius: 20,
                    border: `1.5px solid ${active ? color : T.border}`,
                    background: active ? color + '15' : 'transparent',
                    color: active ? color : T.muted,
                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: font,
                  }}>{meta.label}</button>
                </Tooltip>
              );
            })}
          </div>
        )}

        {(selectedLocs.length > 0 || typeFilter !== 'all') && tab === 'active' && (
          <button onClick={() => { setSelectedLocs([]); setTypeFilter('all'); }} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 20, border: `1px solid ${T.coral}40`,
            background: T.coral + '08', color: T.coral,
            fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: font,
          }}>
            <X size={10} /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Analizando patrones…
        </div>
      ) : tab === 'active' ? (
        filteredAlerts.length === 0 ? (
          <div style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: T.ink, marginBottom: 8 }}>
              {selectedLocs.length > 0 || typeFilter !== 'all' ? 'Sin alertas para este filtro' : '¡Sin alertas activas!'}
            </div>
            <div style={{ fontSize: '0.88rem', color: T.muted, maxWidth: 360, margin: '0 auto' }}>
              {selectedLocs.length > 0 || typeFilter !== 'all'
                ? 'Prueba cambiando los filtros para ver otras alertas.'
                : 'No se detectaron patrones problemáticos en los últimos 30 días. Retelio monitorea continuamente.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredAlerts.map(alert => (
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

      {activePanel && (
        <FeedbackPanel
          alert={activePanel}
          locations={locations}
          tenant={tenant}
          userEmail={userEmail}
          onClose={() => setActivePanel(null)}
          onFeedbackUpdate={updated => setFeedbacks(prev => prev.map(f => f.id === updated.id ? updated : f))}
        />
      )}

      {showDailyValidation && (
        <DailyValidationPanel
          feedbacks={feedbacks}
          locations={locations}
          tenant={tenant}
          userEmail={userEmail}
          onFeedbackUpdate={updated => setFeedbacks(prev => prev.map(f => f.id === updated.id ? updated : f))}
          onClose={() => setShowDailyValidation(false)}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
