import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { dataService } from '../../services/dataService';
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

function buildMessage(fb, locationName, couponCode, couponDesc, couponDays) {
  const name = locationName || 'nuestro negocio';
  const couponLine = couponCode
    ? ` Te queremos compensar con este cupón exclusivo: *${couponCode}*${couponDesc ? ` (${couponDesc})` : ''}${couponDays ? `, válido ${couponDays} días` : ''}. 🎟`
    : '';
  const closing = couponCode ? ' ¿Puedes venir a canjearlo?' : ' ¿Tienes un momento?';

  if (fb.comment) {
    const q = fb.comment.length > 70 ? fb.comment.slice(0, 70) + '…' : fb.comment;
    return `Hola, somos ${name}. Vimos tu visita de hoy y notaste que "${q}" 😔 Queremos resolverlo personalmente.${couponLine}${closing}`;
  }
  if (fb.followup_answer) {
    return `Hola, somos ${name}. Notamos que tuviste un problema con ${fb.followup_answer.toLowerCase()} en tu visita de hoy 😔${couponLine}${closing}`;
  }
  return `Hola, somos ${name}. Notamos que tu experiencia de hoy no fue la que mereces 😔${couponLine}${closing}`;
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

// ─── WhatsApp compose modal ────────────────────────────────────────────────────
function WAComposeModal({ fb, locationName, assignedCfg, onClose, onSend }) {
  const bizName  = locationName || 'nuestro negocio';
  const couponCode = fb.coupon_code || null;

  const [senderName, setSenderName] = useState(() => localStorage.getItem('wa_sender_name') || '');
  const [senderRole, setSenderRole] = useState(() => localStorage.getItem('wa_sender_role') || '');
  const [activeVariant, setActiveVariant] = useState('empatico');
  const [text, setText] = useState('');

  const buildVariant = (style, sName, sRole) => {
    const couponBlock = couponCode
      ? (style === 'oferta'
          ? `\n\n🎟 *Cupón: ${couponCode}*${assignedCfg?.offer_description ? `\n📌 ${assignedCfg.offer_description}` : ''}${assignedCfg?.validity_days ? `\n📅 Válido ${assignedCfg.validity_days} días` : ''}`
          : ` Te queremos compensar con este cupón: *${couponCode}*${assignedCfg?.offer_description ? ` (${assignedCfg.offer_description})` : ''}${assignedCfg?.validity_days ? `, válido ${assignedCfg.validity_days} días` : ''}. 🎟`)
      : '';
    const issue   = fb.followup_answer ? fb.followup_answer.toLowerCase() : fb.comment ? 'lo que mencionaste' : 'tu experiencia';
    const comment = fb.comment ? `"${fb.comment.slice(0,80)}${fb.comment.length > 80 ? '…' : ''}"` : null;

    // Greeting line — personal if name provided
    const greet = sName
      ? `Hola, soy *${sName}*${sRole ? `, ${sRole}` : ''} de ${bizName}.`
      : `Hola, somos ${bizName}.`;

    // Signature — only if name provided
    const sig = sName
      ? `\n\n— *${sName}*${sRole ? `\n  ${sRole}` : ''}`
      : '';

    if (style === 'empatico') return comment
      ? `${greet} Vi personalmente que tu visita de hoy no fue lo que mereces: ${comment} 😔\n\nMe importa mucho tu opinión y quiero hacerlo bien.${couponBlock}\n\n¿Tienes un momento para que lo resolvamos juntos?${sig}`
      : `${greet} Noté que tuviste un problema con ${issue} en tu visita de hoy y eso me preocupa 😔\n\nQuiero que tu próxima visita sea perfecta.${couponBlock}\n\n¿Tienes un momento?${sig}`;

    if (style === 'directo') return comment
      ? `${greet} Noté: ${comment} de hoy.${couponBlock} ¿Puedo compensarte?${sig}`
      : `${greet} Noté el problema con ${issue} de hoy.${couponBlock} ¿Puedo compensarte?${sig}`;

    if (style === 'oferta') return couponCode
      ? `${greet} 👋\n\nSé que tu visita de hoy no fue perfecta. Por eso, quiero invitarte de regreso con este regalo:${couponBlock}\n\n¿Lo aceptas?${sig}`
      : `${greet} Sé que tu visita de hoy no fue perfecta 😔 Quiero compensarte con algo especial. ¿Tienes un momento?${sig}`;

    if (style === 'formal') return `Estimado cliente, le habla ${sName ? `*${sName}*${sRole ? `, ${sRole}` : ''}` : bizName}.\n\nMe informé de que su experiencia durante su visita de hoy no fue completamente satisfactoria${fb.followup_answer ? ` respecto a ${fb.followup_answer.toLowerCase()}` : ''}.${couponBlock}\n\nQuedo a su disposición personalmente para atender su caso. ¿Cuándo podría comunicarme con usted?${sig}`;

    return buildMessage(fb, locationName, couponCode, assignedCfg?.offer_description, assignedCfg?.validity_days);
  };

  const VARIANTS = [
    { key: 'empatico', label: '🤝 Empático'   },
    { key: 'directo',  label: '⚡ Directo'     },
    { key: 'oferta',   label: '🎁 Con oferta'  },
    { key: 'formal',   label: '🏢 Formal'      },
  ];

  // Initialize text on mount
  useEffect(() => {
    setText(buildVariant('empatico', senderName, senderRole));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyVariant = (key) => {
    setActiveVariant(key);
    setText(buildVariant(key, senderName, senderRole));
  };

  const handleSenderName = (v) => {
    setSenderName(v);
    localStorage.setItem('wa_sender_name', v);
    if (activeVariant) setText(buildVariant(activeVariant, v, senderRole));
  };

  const handleSenderRole = (v) => {
    setSenderRole(v);
    localStorage.setItem('wa_sender_role', v);
    if (activeVariant) setText(buildVariant(activeVariant, senderName, v));
  };

  const [copied, setCopied] = useState(false);

  const formatPreview = (msg) =>
    msg.replace(/\*([^*]+)\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

  const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  const handleSend = async () => {
    // Copy full message to clipboard (bypass URL length limit)
    try { await navigator.clipboard.writeText(text); } catch (_) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
    onSend(text);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: 20, width: '100%', maxWidth: 860, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.22)', fontFamily: font }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: T.ink }}>Redactar mensaje de WhatsApp</div>
            <div style={{ fontSize: '0.75rem', color: T.muted, marginTop: 2 }}>📱 {fb.contact_phone} · {locationName}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: T.bg, borderRadius: 8, padding: '7px 11px', cursor: 'pointer', color: T.muted, fontSize: '0.9rem', fontFamily: font }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left: editor */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto', borderRight: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Sender identity */}
            <div style={{ background: T.bg, borderRadius: 12, padding: '14px 16px', border: `1.5px solid ${T.border}` }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>👤 ¿Quién envía el mensaje?</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', color: T.muted, marginBottom: 4 }}>Tu nombre</div>
                  <input
                    value={senderName}
                    onChange={e => handleSenderName(e.target.value)}
                    placeholder="Jorge Espindola"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${senderName ? '#25D366' : T.border}`, fontFamily: font, fontSize: '0.85rem', color: T.ink, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', color: T.muted, marginBottom: 4 }}>Tu cargo</div>
                  <input
                    value={senderRole}
                    onChange={e => handleSenderRole(e.target.value)}
                    placeholder="Director de Servicio a Clientes"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${senderRole ? '#25D366' : T.border}`, fontFamily: font, fontSize: '0.85rem', color: T.ink, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              {senderName && (
                <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#15803D' }}>
                  ✓ El mensaje irá firmado como <strong>{senderName}{senderRole ? `, ${senderRole}` : ''}</strong>
                </div>
              )}
            </div>

            {/* Tone chips */}
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Tono del mensaje</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {VARIANTS.map(v => (
                  <button key={v.key} onClick={() => applyVariant(v.key)} style={{
                    padding: '6px 14px', borderRadius: 99,
                    border: `1.5px solid ${activeVariant === v.key ? '#25D366' : T.border}`,
                    background: activeVariant === v.key ? '#F0FDF4' : T.bg,
                    color: activeVariant === v.key ? '#15803D' : T.ink,
                    fontFamily: font, fontSize: '0.78rem', fontWeight: activeVariant === v.key ? 700 : 500, cursor: 'pointer', transition: 'all .12s',
                  }}>{v.label}</button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Editar mensaje</div>
              <textarea
                value={text}
                onChange={e => { setText(e.target.value); setActiveVariant(null); }}
                style={{
                  width: '100%', minHeight: 180, padding: '12px 14px', borderRadius: 12,
                  border: `1.5px solid ${T.border}`, fontFamily: font, fontSize: '0.88rem',
                  color: T.ink, lineHeight: 1.65, resize: 'vertical', outline: 'none',
                  background: T.bg, boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: '0.7rem', color: text.length > 1000 ? T.red : T.muted, textAlign: 'right', marginTop: 4 }}>
                {text.length} caracteres
              </div>
            </div>

            {/* Tip */}
            <div style={{ padding: '10px 14px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A', fontSize: '0.75rem', color: '#92400E', lineHeight: 1.5 }}>
              💡 Usa <strong>*asteriscos*</strong> para <strong>negrita</strong> en WhatsApp. Saltos de línea se verán tal cual en el chat.
            </div>
          </div>

          {/* Right: phone preview */}
          <div style={{ width: 280, padding: '24px 20px', background: '#ECE5DD', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0, overflowY: 'auto' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '.08em' }}>Vista previa</div>

            {/* Phone frame */}
            <div style={{ width: 222, background: '#ECE5DD', borderRadius: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.22)', overflow: 'hidden', border: '7px solid #111' }}>
              {/* Notch */}
              <div style={{ background: '#111', height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 50, height: 5, background: '#333', borderRadius: 99 }} />
              </div>
              {/* WA status bar */}
              <div style={{ background: '#075E54', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#128C7E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0 }}>🏪</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{locationName || 'Tu negocio'}</div>
                  <div style={{ color: '#B2DFDB', fontSize: '0.58rem' }}>en línea</div>
                </div>
              </div>
              {/* Chat */}
              <div style={{ minHeight: 180, padding: '10px 8px', background: '#ECE5DD', backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8b89a' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
                {/* Date bubble */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <span style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 99, padding: '2px 8px', fontSize: '0.58rem', color: '#6B6B6B' }}>Hoy</span>
                </div>
                {/* Message bubble */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ background: '#DCF8C6', borderRadius: '10px 0 10px 10px', padding: '6px 8px', maxWidth: '88%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '0.65rem', color: '#303030', lineHeight: 1.5, wordBreak: 'break-word' }}
                      dangerouslySetInnerHTML={{ __html: formatPreview(text) }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: 3 }}>
                      <span style={{ fontSize: '0.55rem', color: '#7B8B6F' }}>{timeStr}</span>
                      <span style={{ fontSize: '0.6rem', color: '#53BDEB' }}>✓✓</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Input bar */}
              <div style={{ background: '#F0F2F5', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>😊</div>
                <div style={{ flex: 1, background: '#fff', borderRadius: 99, padding: '4px 10px', fontSize: '0.6rem', color: '#999' }}>Mensaje</div>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>🎤</div>
              </div>
              {/* Home bar */}
              <div style={{ background: '#111', height: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 40, height: 3, background: '#444', borderRadius: 99 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '0.78rem', color: copied ? '#15803D' : T.muted, display: 'flex', alignItems: 'center', gap: 6, transition: 'color .2s' }}>
            {copied
              ? <><span style={{ fontWeight: 700 }}>✓ Mensaje copiado</span> — solo pega con Ctrl+V en WhatsApp</>
              : <span style={{ color: T.muted }}>El mensaje se copiará al portapapeles automáticamente</span>
            }
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.bg, fontFamily: font, fontSize: '0.85rem', cursor: 'pointer', color: T.muted, fontWeight: 600 }}>Cancelar</button>
            <button onClick={handleSend} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#25D366', color: '#fff', fontFamily: font, fontSize: '0.88rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 3px 10px rgba(37,211,102,0.35)' }}>
              <MessageSquare size={15} /> Abrir en WhatsApp →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Queue card ────────────────────────────────────────────────────────────────
function QueueCard({ fb, locationName, qrLabel, bucket, userEmail, coupons, onUpdate, isEscalated }) {
  const [saving, setSaving]         = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [showWAModal, setShowWAModal] = useState(false);

  const contacted  = fb.recovery_status === 'contacted' || fb.recovery_status === 'resolved';
  const resolved   = fb.recovery_status === 'resolved' || fb.coupon_redeemed;
  const scoreColor = fb.score <= 1 ? T.red : T.coral;

  const borderColor = resolved ? T.teal : bucket === 'hot' ? T.red : bucket === 'warm' ? T.amber : T.muted;

  const assignedCfg = fb.coupon_config_id ? coupons.find(c => c.id === fb.coupon_config_id) : null;

  const handleWhatsApp = async (customText) => {
    const finalText = customText || buildMessage(fb, locationName, fb.coupon_code || null, assignedCfg?.offer_description || null, assignedCfg?.validity_days || null);
    const phone = fb.contact_phone.replace(/\D/g, '');
    // Use text in URL only if short enough (≤ 500 chars); otherwise clipboard was already set by modal
    const urlText = finalText.length <= 500 ? `?text=${encodeURIComponent(finalText)}` : '';
    window.open(`https://wa.me/52${phone}${urlText}`, '_blank');
    setShowWAModal(false);
    setSaving(true);
    const now = new Date().toISOString();
    const u = { recovery_status: 'contacted', recovery_at: now, recovery_actor: userEmail };
    const table = fb._table || 'feedbacks';
    await supabase.from(table).update(u).eq('id', fb.id);
    onUpdate({ ...fb, ...u });
    setSaving(false);
  };

  const handleResolved = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const u = { recovery_status: 'resolved', recovery_resolved_at: now };
    const table = fb._table || 'feedbacks';
    await supabase.from(table).update(u).eq('id', fb.id);
    onUpdate({ ...fb, ...u });
    setSaving(false);
  };

  const handleAssignCoupon = async (cfg) => {
    setSaving(true);
    setCouponOpen(false);
    const code = genCode(cfg.coupon_prefix || 'MANUAL');
    const upd = { coupon_code: code, coupon_config_id: cfg.id, recovery_sent: true };
    const table = fb._table || 'feedbacks';
    await supabase.from(table).update(upd).eq('id', fb.id);
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

  const accentColor = resolved ? T.teal : isEscalated ? T.red : bucket === 'hot' ? T.red : bucket === 'warm' ? T.amber : T.muted;

  return (
    <div style={{
      background: resolved ? '#F0FDF4' : isEscalated ? '#FFF5F5' : T.card,
      border: `1.5px solid ${resolved ? '#BBF7D0' : isEscalated ? '#FECACA' : T.border}`,
      borderLeft: `4px solid ${accentColor}`,
      borderRadius: 14, padding: '16px 18px',
      animation: isEscalated ? 'escalate-pulse 2s ease-in-out infinite' : 'none',
      opacity: resolved ? 0.8 : 1,
    }}>

      {/* Top row: score + location + time + urgency badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: scoreColor + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: scoreColor, fontSize: '1rem', flexShrink: 0 }}>
            {fb.score}★
          </div>
          <div>
            <div style={{ fontWeight: 700, color: T.ink, fontSize: '0.88rem' }}>
              {locationName || '—'}
              {qrLabel && <span style={{ fontWeight: 600, color: T.purple, fontSize: '0.78rem' }}> · 📍 {qrLabel}</span>}
            </div>
            <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 1 }}>
              {formatDistanceToNow(new Date(fb.created_at), { locale: es, addSuffix: true })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {resolved
            ? <span style={badge(T.teal)}>✓ Recuperado</span>
            : contacted
            ? <span style={badge(T.teal)}>Contactado</span>
            : bucket === 'hot'
            ? <Timer createdAt={fb.created_at} />
            : bucket === 'warm'
            ? <span style={{ fontSize: '0.72rem', color: T.amber, fontWeight: 700 }}>⏳ Hoy</span>
            : <span style={{ fontSize: '0.72rem', color: T.muted, fontWeight: 600 }}>
                {formatDistanceToNow(new Date(fb.created_at), { locale: es, addSuffix: true })}
              </span>
          }
        </div>
      </div>

      {/* Problem — full text visible */}
      {(fb.followup_answer || fb.comment) && (
        <div style={{ background: T.bg, borderRadius: 10, padding: '10px 14px', marginBottom: 12, border: `1px solid ${T.border}` }}>
          {fb.followup_answer && (
            <span style={{ fontWeight: 700, color: T.coral, fontSize: '0.85rem' }}>{fb.followup_answer}{fb.comment ? ' · ' : ''}</span>
          )}
          {fb.comment && (
            <span style={{ fontSize: '0.85rem', color: T.ink, fontStyle: 'italic' }}>"{fb.comment}"</span>
          )}
        </div>
      )}

      {/* WA message preview */}
      {fb.contact_phone && !resolved && (
        <div onClick={() => setShowWAModal(true)} style={{ fontSize: '0.75rem', color: T.muted, lineHeight: 1.5, marginBottom: 12, padding: '8px 12px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0', cursor: 'pointer' }}>
          <span style={{ fontWeight: 700, color: '#16A34A', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>Mensaje sugerido · </span>
          <span style={{ color: '#15803D' }}>{buildMessage(fb, locationName, fb.coupon_code || null, assignedCfg?.offer_description || null, assignedCfg?.validity_days || null)}</span>
          <span style={{ marginLeft: 6, fontSize: '0.65rem', color: T.muted }}>✏️ editar</span>
        </div>
      )}

      {/* Bottom row: phone + coupon + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {fb.contact_phone
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Phone size={13} color="#25D366" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: T.ink }}>{fb.contact_phone}</span>
              </div>
            : <span style={{ fontSize: '0.75rem', color: T.muted }}>Sin teléfono</span>
          }
          {fb.coupon_code && (
            <span style={{ fontSize: '0.72rem', color: T.purple, fontWeight: 700, background: T.purple + '10', borderRadius: 999, padding: '2px 8px' }}>
              🎟 {fb.coupon_code}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Assign coupon */}
          {!fb.coupon_code && coupons.length > 0 && !resolved && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setCouponOpen(o => !o)} disabled={saving} style={{
                padding: '8px 12px', borderRadius: 9, border: `1.5px dashed ${T.border}`,
                background: T.card, cursor: 'pointer', fontFamily: font,
                fontSize: '0.78rem', fontWeight: 600, color: T.muted,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Tag size={12} /> Cupón ▾
              </button>
              {couponOpen && (
                <>
                  <div onClick={() => setCouponOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
                  <div style={{
                    position: 'absolute', bottom: '100%', right: 0, marginBottom: 4, zIndex: 20,
                    background: T.card, border: `1.5px solid ${T.border}`, borderRadius: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 240, overflow: 'hidden',
                  }}>
                    {coupons.map((cfg, i) => (
                      <button key={i} onClick={() => handleAssignCoupon(cfg)} style={{
                        width: '100%', padding: '10px 14px', border: 'none', background: 'none',
                        cursor: 'pointer', textAlign: 'left', fontFamily: font,
                        borderBottom: i < coupons.length - 1 ? `1px solid ${T.border}` : 'none',
                      }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: T.ink }}>{cfg.offer_description || cfg.coupon_prefix}</div>
                        <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: 2 }}>Válido {cfg.validity_days || 30} días · {cfg.coupon_prefix}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mark resolved */}
          {contacted && !resolved && (
            <button onClick={handleResolved} disabled={saving} style={{
              padding: '9px 16px', borderRadius: 9, border: 'none',
              background: T.teal, color: '#fff', fontFamily: font,
              fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <CheckCircle2 size={14} /> Recuperado
            </button>
          )}

          {/* WhatsApp — primary CTA */}
          {fb.contact_phone && !resolved && (
            <button onClick={() => setShowWAModal(true)} disabled={saving} style={{
              padding: '9px 18px', borderRadius: 9, border: 'none',
              background: contacted ? '#F0FDF4' : '#25D366',
              color: contacted ? '#16A34A' : '#fff',
              fontFamily: font, fontSize: '0.88rem', fontWeight: 800,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: contacted ? 'none' : '0 3px 10px rgba(37,211,102,0.35)',
            }}>
              {saving
                ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <MessageSquare size={14} />
              }
              {contacted ? 'Reenviar WA' : 'WhatsApp →'}
            </button>
          )}
        </div>
      </div>

      {showWAModal && (
        <WAComposeModal
          fb={fb}
          locationName={locationName}
          assignedCfg={assignedCfg}
          onClose={() => setShowWAModal(false)}
          onSend={handleWhatsApp}
        />
      )}
    </div>
  );
}

// ─── Followup card (En seguimiento) ───────────────────────────────────────────
function FollowupCard({ fb, locationName, qrLabel, userEmail, coupons, onUpdate }) {
  const [saving, setSaving]   = useState(false);
  const [showWAModal, setShowWAModal] = useState(false);
  const [couponOpen, setCouponOpen]   = useState(false);

  const status      = fb.recovery_status;
  const scoreColor  = fb.score <= 1 ? T.red : T.coral;
  const assignedCfg = fb.coupon_config_id ? coupons.find(c => c.id === fb.coupon_config_id) : null;

  const STATUS_META = {
    contacted: { label: '📤 Enviado',      color: '#3B82F6', bg: '#EFF6FF' },
    responded:  { label: '💬 Respondió',    color: T.amber,   bg: '#FFFBEB' },
    committed:  { label: '🤝 Comprometido', color: T.teal,    bg: '#F0FDF4' },
  };
  const meta = STATUS_META[status] || STATUS_META.contacted;

  const ACTIONS = {
    contacted: { primary: { label: '💬 Respondió',       next: 'responded' }, secondary: { label: 'Sin respuesta', next: 'lost' } },
    responded:  { primary: { label: '🤝 Va a regresar',   next: 'committed' }, secondary: { label: 'No le interesa', next: 'lost' } },
    committed:  { primary: { label: '✅ Recuperado',       next: 'resolved'  }, secondary: { label: 'No regresó',     next: 'lost' } },
  };
  const act = ACTIONS[status] || ACTIONS.contacted;

  const advance = async (newStatus) => {
    setSaving(true);
    const now = new Date().toISOString();
    const u = (newStatus === 'resolved' || newStatus === 'lost')
      ? { recovery_status: newStatus, recovery_resolved_at: now }
      : { recovery_status: newStatus };
    const table = fb._table || 'feedbacks';
    const { error } = await supabase.from(table).update(u).eq('id', fb.id);
    if (error) console.error('Update recovery status error:', error);
    onUpdate({ ...fb, ...u });
    setSaving(false);
  };

  const handleWhatsApp = async (customText) => {
    const finalText = customText || buildMessage(fb, locationName, fb.coupon_code || null, assignedCfg?.offer_description || null, assignedCfg?.validity_days || null);
    const phone = fb.contact_phone.replace(/\D/g, '');
    const urlText = finalText.length <= 500 ? `?text=${encodeURIComponent(finalText)}` : '';
    window.open(`https://wa.me/52${phone}${urlText}`, '_blank');
    setShowWAModal(false);
  };

  const handleAssignCoupon = async (cfg) => {
    setSaving(true); setCouponOpen(false);
    const code = genCode(cfg.coupon_prefix || 'MANUAL');
    const upd = { coupon_code: code, coupon_config_id: cfg.id, recovery_sent: true };
    const table = fb._table || 'feedbacks';
    await supabase.from(table).update(upd).eq('id', fb.id);
    onUpdate({ ...fb, ...upd });
    setSaving(false);
  };

  return (
    <div style={{ background: meta.bg, border: `1.5px solid ${meta.color}30`, borderLeft: `4px solid ${meta.color}`, borderRadius: 14, padding: '16px 18px' }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: scoreColor + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: scoreColor, fontSize: '1rem', flexShrink: 0 }}>{fb.score}★</div>
          <div>
            <div style={{ fontWeight: 700, color: T.ink, fontSize: '0.88rem' }}>
              {locationName || '—'}
              {qrLabel && <span style={{ fontWeight: 600, color: T.purple, fontSize: '0.78rem' }}> · 📍 {qrLabel}</span>}
            </div>
            <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 1 }}>
              {formatDistanceToNow(new Date(fb.created_at), { locale: es, addSuffix: true })}
              {fb.recovery_at && <span> · Contactado {formatDistanceToNow(new Date(fb.recovery_at), { locale: es, addSuffix: true })}</span>}
            </div>
          </div>
        </div>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: meta.color, background: meta.color + '18', padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>{meta.label}</span>
      </div>

      {/* Problem */}
      {(fb.followup_answer || fb.comment) && (
        <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, border: `1px solid ${meta.color}20` }}>
          {fb.followup_answer && <span style={{ fontWeight: 700, color: T.coral, fontSize: '0.85rem' }}>{fb.followup_answer}{fb.comment ? ' · ' : ''}</span>}
          {fb.comment && <span style={{ fontSize: '0.85rem', color: T.ink, fontStyle: 'italic' }}>"{fb.comment}"</span>}
        </div>
      )}

      {/* Bottom row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {fb.contact_phone && <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={13} color="#25D366" /><span style={{ fontSize: '0.82rem', fontWeight: 700, color: T.ink }}>{fb.contact_phone}</span></div>}
          {fb.coupon_code
            ? <span style={{ fontSize: '0.72rem', color: T.purple, fontWeight: 700, background: T.purple + '10', borderRadius: 999, padding: '2px 8px' }}>🎟 {fb.coupon_code}</span>
            : coupons.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setCouponOpen(o => !o)} style={{ padding: '5px 10px', borderRadius: 8, border: `1.5px dashed ${T.border}`, background: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontFamily: font, fontSize: '0.75rem', color: T.muted, display: 'flex', alignItems: 'center', gap: 4 }}><Tag size={11} /> Cupón ▾</button>
                {couponOpen && (
                  <>
                    <div onClick={() => setCouponOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
                    <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 4, zIndex: 20, background: T.card, border: `1.5px solid ${T.border}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 240, overflow: 'hidden' }}>
                      {coupons.map((cfg, i) => (
                        <button key={i} onClick={() => handleAssignCoupon(cfg)} style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: font, borderBottom: i < coupons.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: T.ink }}>{cfg.offer_description || cfg.coupon_prefix}</div>
                          <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: 2 }}>Válido {cfg.validity_days || 30} días · {cfg.coupon_prefix}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          }
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => advance(act.secondary.next)} disabled={saving} style={{ padding: '7px 12px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: font, fontSize: '0.75rem', fontWeight: 600, color: T.muted }}>{act.secondary.label}</button>
          {fb.contact_phone && (
            <button onClick={() => setShowWAModal(true)} disabled={saving} style={{ padding: '7px 12px', borderRadius: 9, border: `1.5px solid #25D366`, background: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: font, fontSize: '0.75rem', fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 5 }}>
              <MessageSquare size={12} /> WA
            </button>
          )}
          <button onClick={() => advance(act.primary.next)} disabled={saving} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: meta.color, color: '#fff', fontFamily: font, fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: `0 3px 8px ${meta.color}40` }}>
            {saving ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : act.primary.label}
          </button>
        </div>
      </div>

      {showWAModal && <WAComposeModal fb={fb} locationName={locationName} assignedCfg={assignedCfg} onClose={() => setShowWAModal(false)} onSend={handleWhatsApp} />}
    </div>
  );
}

// ─── History card ──────────────────────────────────────────────────────────────
function HistoryCard({ fb, locationName, qrLabel }) {
  const recovered  = fb.recovery_status === 'resolved' || fb.coupon_redeemed;
  const scoreColor = fb.score <= 1 ? T.red : T.coral;

  return (
    <div style={{ background: T.card, border: `1.5px solid ${T.border}`, borderLeft: `4px solid ${recovered ? T.teal : T.muted}`, borderRadius: 14, padding: '14px 18px', opacity: 0.9 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: scoreColor + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: scoreColor, fontSize: '0.9rem', flexShrink: 0 }}>{fb.score}★</div>
          <div>
            <div style={{ fontWeight: 700, color: T.ink, fontSize: '0.85rem' }}>
              {locationName || '—'}
              {qrLabel && <span style={{ fontWeight: 600, color: T.purple, fontSize: '0.75rem' }}> · 📍 {qrLabel}</span>}
            </div>
            <div style={{ fontSize: '0.7rem', color: T.muted, marginTop: 1 }}>
              {formatDistanceToNow(new Date(fb.created_at), { locale: es, addSuffix: true })}
              {fb.recovery_resolved_at && <span> · Cerrado {formatDistanceToNow(new Date(fb.recovery_resolved_at), { locale: es, addSuffix: true })}</span>}
            </div>
            {(fb.followup_answer || fb.comment) && (
              <div style={{ fontSize: '0.75rem', color: T.muted, marginTop: 3 }}>
                {fb.followup_answer && <span style={{ color: T.coral, fontWeight: 600 }}>{fb.followup_answer}{fb.comment ? ' — ' : ''}</span>}
                {fb.comment && <span style={{ fontStyle: 'italic' }}>"{fb.comment.slice(0,80)}{fb.comment.length > 80 ? '…' : ''}"</span>}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {fb.coupon_code && (
            <span style={{ fontSize: '0.7rem', color: T.purple, fontWeight: 700, background: T.purple + '10', borderRadius: 999, padding: '2px 8px' }}>
              🎟 {fb.coupon_code}{fb.coupon_redeemed ? ' ✓' : ''}
            </span>
          )}
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: recovered ? T.teal : T.muted, background: (recovered ? T.teal : T.muted) + '15', padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
            {recovered ? '✅ Recuperado' : '❌ No recuperado'}
          </span>
        </div>
      </div>
    </div>
  );
}

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

  // Use real redeemed_amount when available (matches main dashboard), else fall back to estimate
  const realRevenue = recoveredThisMonth.reduce((acc, f) => {
    const amt = parseFloat(f.redeemed_amount);
    return acc + (isNaN(amt) ? 0 : amt);
  }, 0);
  const hasRealData = realRevenue > 0;
  const revenue = hasRealData ? realRevenue : recoveredThisMonth.length * avgTicket;

  return (
    <div style={{ background: T.card, borderRadius: 18, padding: '20px 24px', border: `1px solid ${T.border}`, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>💰 Revenue recuperado este mes</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em' }}>${revenue.toLocaleString('es-MX')}</div>
          <div style={{ fontSize: '0.78rem', color: T.muted, marginTop: 2 }}>
            {recoveredThisMonth.length} de {withPhone.length} clientes con teléfono
            {!hasRealData && <span style={{ color: T.amber, marginLeft: 6 }}>· estimado</span>}
          </div>
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
        {!hasRealData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.72rem', color: T.muted }}>Ticket promedio:</span>
            <button onClick={onEditTicket} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: font, fontSize: '0.78rem', fontWeight: 700, color: T.ink, display: 'flex', alignItems: 'center', gap: 4 }}>
              ${avgTicket} <Edit2 size={11} color={T.muted} />
            </button>
          </div>
        )}
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
    const table = fb._table || 'feedbacks';
    await supabase.from(table).update(u).eq('id', fb.id).eq('tenant_id', tenant.id);
    onUpdate({ ...fb, ...u });
    setSaving(null);
  };

  const markNotReturned = async (fb) => {
    setSaving(fb.id + '_no');
    const table = fb._table || 'feedbacks';
    await supabase.from(table).update({ coupon_not_returned: true }).eq('id', fb.id).eq('tenant_id', tenant.id);
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
export default function IssueManagement({ tenantOverride } = {}) {
  const { tenant: tenantFromHook } = useTenant();
  const tenant = tenantOverride || tenantFromHook;
  const [feedbacks, setFeedbacks]       = useState([]);
  const [locations, setLocations]       = useState([]);
  const [qrLabels, setQrLabels]         = useState({});
  const [coupons, setCoupons]           = useState([]);
  const [recoveryConfig, setRecoveryConfig] = useState(null);
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

  // Auto-refresh every 2 minutes — recovery is time-sensitive
  useEffect(() => {
    if (!tenant?.id) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadData();
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [tenant?.id]);

  const loadData = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    
    try {
      const isTest = !!tenant.test_mode;
      const [feedbacks, stores, areas, recoveryConfigRes, qrCodesRes] = await Promise.all([
        dataService.fetchFeedbacks(tenant.id, isTest),
        dataService.fetchStores(tenant.id),
        dataService.fetchAreas(tenant.id),
        supabase.from('recovery_config').select('*').eq('tenant_id', tenant.id),
        supabase.from('qr_codes').select('id, label').eq('tenant_id', tenant.id)
      ]);

      setLocations(stores);
      // Adaptive thresholds: <= 6 for NPS (0-10), <= 2 for Emoji (1-5)
      // Since dataService already handles normalization and test filtering, we just calculate the threshold.
      const maxScore = Math.max(...feedbacks.map(f => f.score ?? 0), 0);
      const unhappyThreshold = maxScore > 5 ? 6 : 2;
      // Include BOTH unhappy customers AND anyone with a coupon (for validation/stats)
      setFeedbacks(feedbacks.filter(f => f.score <= unhappyThreshold || f.coupon_code));
      setRecoveryConfig(recoveryConfigRes.data?.[0] || null);
      setQrLabels(Object.fromEntries((qrCodesRes.data || []).map(q => [q.id, q.label])));

      // ── Escalation check ──────────────────────────────────────────────────────
      const nowMs = Date.now();
      const toEscalate = feedbacks.filter(f => {
        if (!f.contact_phone) return false;
        if (f.recovery_status && f.recovery_status !== 'pending') return false;
        const ageMin = (nowMs - new Date(f.created_at)) / 60000;
        if (ageMin < 90 || ageMin > 120) return false; // 90–120 min window
        return !localStorage.getItem(`esc_${f.id}`);
      });

      if (toEscalate.length > 0) {
        const locsMap = Object.fromEntries(stores.map(l => [l.id, l]));
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
    } catch (error) {
      console.error('IssueManagement load error:', error);
    } finally {
      setLoading(false);
    }
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

  // ── Pending (Sin atender) ──────────────────────────────────────────────────
  // IMPORTANT: For the ACTION queue, only show detractors (bad scores) that have no status yet
  const allPending = feedbacks.filter(f => 
    (!f.recovery_status || f.recovery_status === 'pending') && 
    (f.score <= (Math.max(...feedbacks.map(x => x.score ?? 0), 0) > 5 ? 6 : 2))
  );
  const hotAll     = allPending.filter(f => new Date(f.created_at) > subHours(now, 2));
  const warmAll    = allPending.filter(f => new Date(f.created_at) <= subHours(now, 2) && new Date(f.created_at) > subHours(now, 24));
  const expiredAll = allPending.filter(f => new Date(f.created_at) <= subHours(now, 24));

  const hot     = hotAll.filter(f => f.contact_phone);
  const warm    = warmAll.filter(f => f.contact_phone);
  const expired = expiredAll.filter(f => f.contact_phone);
  const noPhone = allPending.filter(f => !f.contact_phone);

  // ── En seguimiento ─────────────────────────────────────────────────────────
  const followupRows = feedbacks.filter(f => ['contacted', 'responded', 'committed'].includes(f.recovery_status));

  // ── Historial ──────────────────────────────────────────────────────────────
  const historyRows = feedbacks.filter(f => ['resolved', 'lost'].includes(f.recovery_status) || f.coupon_redeemed);

  const getBucket = (fb) => {
    if (new Date(fb.created_at) > subHours(now, 2)) return 'hot';
    if (new Date(fb.created_at) > subHours(now, 24)) return 'warm';
    return 'cold';
  };

  const queueRows = useMemo(() => {
    let rows = [...hot, ...warm];
    if (filter === 'hot')  rows = hot;
    if (filter === 'warm') rows = warm;
    if (filter === 'cold') rows = expired;
    return rows;
  }, [feedbacks, filter]);

  const totalActionable = hot.length + warm.length;
  const pendingCoupons  = feedbacks.filter(f => f.coupon_code && !f.coupon_redeemed && !f.coupon_not_returned).length;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto', fontFamily: font }}>

      {tenant?.test_mode && (
        <div style={{ background: '#FEF3C7', border: '1.5px solid #FDE68A', borderRadius: 12, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem' }}>🧪</span>
          <div style={{ fontSize: '0.8rem', color: '#92400E', fontWeight: 600 }}>
            MODO PRUEBA ACTIVO — Solo se muestran feedbacks de prueba. Desactívalo en ajustes para ver datos reales.
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: T.ink, marginBottom: 2 }}>Recuperación</h2>
          <p style={{ fontSize: '0.82rem', color: T.muted }}>
            {loading ? 'Cargando…' : `${totalActionable} por contactar · ${followupRows.length} en seguimiento · ${expired.length} vencidos`}
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
            hot={hot.length} warm={warm.length} cold={expired.length}
            activeFilter={filter} onFilter={setFilter}
          />
        </>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: T.bg, borderRadius: 12, padding: 4, width: 'fit-content', flexWrap: 'wrap' }}>
        {[
          { key: 'queue',      label: 'Sin atender',     badge: totalActionable + expired.length, badgeColor: totalActionable > 0 ? T.red : T.muted },
          { key: 'followup',   label: 'En seguimiento',  badge: followupRows.length, badgeColor: '#3B82F6' },
          { key: 'validation', label: 'Validar cupones', badge: pendingCoupons,      badgeColor: T.amber },
          { key: 'history',    label: 'Historial',       badge: 0,                  badgeColor: T.muted },
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

      {/* Tab: Sin atender */}
      {tab === 'queue' && (
        loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3].map(i => <div key={i} style={{ height: 56, background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : (
          <>
            {queueRows.length === 0 && !expired.length ? (
              <div style={{ textAlign: 'center', padding: '64px 24px' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏆</div>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: '1.1rem', marginBottom: 8 }}>Sin clientes por atender</div>
                <div style={{ fontSize: '0.88rem', color: T.muted }}>No hay feedback negativo reciente que requiera acción.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {queueRows.map(fb => (
                  <QueueCard key={fb.id} fb={fb}
                    locationName={locations.find(l => l.id === fb.location_id)?.name}
                    qrLabel={qrLabels[fb.qr_id] || null}
                    bucket={getBucket(fb)}
                    userEmail={userEmail}
                    coupons={coupons}
                    onUpdate={updateFeedback}
                    isEscalated={escalationBanner.some(e => e.id === fb.id)}
                  />
                ))}
              </div>
            )}

            {/* Vencidos section */}
            {expired.length > 0 && !filter && (
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>
                    ⚠️ Vencidos sin contactar ({expired.length}) — ventana de recuperación cerrada
                  </span>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: T.muted, marginBottom: 10, padding: '8px 12px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A' }}>
                  💡 La probabilidad de recuperar baja a ~15%, pero aún vale el intento. Un mensaje tardío es mejor que ninguno.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {expired.map(fb => (
                    <QueueCard key={fb.id} fb={fb}
                      locationName={locations.find(l => l.id === fb.location_id)?.name}
                      qrLabel={qrLabels[fb.qr_id] || null}
                      bucket="cold"
                      userEmail={userEmail}
                      coupons={coupons}
                      onUpdate={updateFeedback}
                      isEscalated={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {noPhone.length > 0 && !filter && (
              <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 12, background: T.bg, border: `1px solid ${T.border}`, fontSize: '0.78rem', color: T.muted }}>
                <strong style={{ color: T.ink }}>{noPhone.length} sin teléfono</strong> — El formulario ahora pide contacto; esto mejorará con el tiempo.
              </div>
            )}
          </>
        )
      )}

      {/* Tab: En seguimiento */}
      {tab === 'followup' && !loading && (
        followupRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>💬</div>
            <div style={{ fontWeight: 800, color: T.ink, marginBottom: 8 }}>Sin conversaciones activas</div>
            <div style={{ fontSize: '0.85rem', color: T.muted }}>Los clientes que contactes por WhatsApp aparecerán aquí para hacer seguimiento.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {followupRows.map(fb => (
              <FollowupCard key={fb.id} fb={fb}
                locationName={locations.find(l => l.id === fb.location_id)?.name}
                qrLabel={qrLabels[fb.qr_id] || null}
                userEmail={userEmail}
                coupons={coupons}
                onUpdate={updateFeedback}
              />
            ))}
          </div>
        )
      )}

      {/* Tab: Validar cupones */}
      {tab === 'validation' && !loading && (
        <ValidationTab feedbacks={feedbacks} locations={locations} tenant={tenant} userEmail={userEmail} onUpdate={updateFeedback} />
      )}

      {/* Tab: Historial */}
      {tab === 'history' && !loading && (
        historyRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 800, color: T.ink, marginBottom: 8 }}>Sin casos cerrados aún</div>
            <div style={{ fontSize: '0.85rem', color: T.muted }}>Los casos recuperados y no recuperados aparecerán aquí.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Recuperados', count: historyRows.filter(f => f.recovery_status === 'resolved' || f.coupon_redeemed).length, color: T.teal },
                { label: 'No recuperados', count: historyRows.filter(f => f.recovery_status === 'lost' && !f.coupon_redeemed).length, color: T.muted },
                { label: 'Tasa de éxito', count: historyRows.length > 0 ? Math.round(historyRows.filter(f => f.recovery_status === 'resolved' || f.coupon_redeemed).length / historyRows.length * 100) + '%' : '—', color: T.purple },
              ].map(s => (
                <div key={s.label} style={{ background: T.card, border: `1.5px solid ${T.border}`, borderRadius: 14, padding: '14px 18px' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color }}>{s.count}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historyRows.map(fb => (
                <HistoryCard key={fb.id} fb={fb}
                  locationName={locations.find(l => l.id === fb.location_id)?.name}
                  qrLabel={qrLabels[fb.qr_id] || null}
                />
              ))}
            </div>
          </>
        )
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
