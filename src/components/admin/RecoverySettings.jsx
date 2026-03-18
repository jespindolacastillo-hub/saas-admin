import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import {
  Gift, Zap, MessageSquare, CheckCircle2, AlertCircle, TrendingUp,
  Settings, Loader, Percent, DollarSign, Star,
} from 'lucide-react';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  coral:  '#FF5C3A',
  teal:   '#00C9A7',
  purple: '#7C3AED',
  ink:    '#0D0D12',
  muted:  '#6B7280',
  border: '#E5E7EB',
  bg:     '#F7F8FC',
  card:   '#FFFFFF',
  green:  '#16A34A',
  amber:  '#F59E0B',
  red:    '#DC2626',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const DEFAULT_CONFIG = {
  enabled: true,
  trigger_score: 2,
  offer_type: 'percentage',
  offer_value: 20,
  offer_description: '20% de descuento en tu próxima visita',
  coupon_prefix: 'RECOVERY',
  message_template:
    'Hola, lamentamos tu experiencia. Como muestra de aprecio te ofrecemos: {{oferta}}. Usa el código {{codigo}} · válido {{dias}} días. — {{negocio}}',
  validity_days: 30,
  terms: '',
};

// ─── Offer type options ───────────────────────────────────────────────────────
const OFFER_TYPES = [
  { value: 'percentage', label: 'Porcentaje', icon: Percent },
  { value: 'fixed',      label: 'Monto fijo', icon: DollarSign },
  { value: 'free_item',  label: 'Artículo gratis', icon: Gift },
  { value: 'custom',     label: 'Personalizado', icon: Star },
];

// ─── Preview phone mockup ─────────────────────────────────────────────────────
function PhonePreview({ config, tenantName }) {
  const sampleCode = `${config.coupon_prefix || 'RECOVERY'}-X3K9A`;

  const ofertaText =
    config.offer_type === 'percentage' ? `${config.offer_value}% de descuento` :
    config.offer_type === 'fixed'      ? `$${config.offer_value} de descuento` :
    config.offer_type === 'free_item'  ? config.offer_description :
    config.offer_description || 'oferta especial';

  const rendered = (config.message_template || '')
    .replace('{{oferta}}',  ofertaText)
    .replace('{{codigo}}',  sampleCode)
    .replace('{{dias}}',    String(config.validity_days || 30))
    .replace('{{negocio}}', tenantName || 'Tu negocio');

  const offerTypeBadge =
    config.offer_type === 'percentage' ? { label: `${config.offer_value}% OFF`, color: T.teal } :
    config.offer_type === 'fixed'      ? { label: `$${config.offer_value} MXN`, color: T.green } :
    config.offer_type === 'free_item'  ? { label: 'Artículo gratis', color: T.purple } :
    { label: 'Oferta especial', color: T.coral };

  return (
    <div style={{
      background: '#1A1A2E', borderRadius: 28, padding: '28px 20px',
      maxWidth: 280, margin: '0 auto',
      boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      border: '2px solid rgba(255,255,255,0.08)',
    }}>
      {/* Top notch */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 999 }} />
      </div>

      {/* Message bubble */}
      <div style={{
        background: 'rgba(255,255,255,0.06)', borderRadius: 16,
        padding: '16px', marginBottom: 12,
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: T.coral + '30',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Gift size={14} color={T.coral} />
          </div>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Mensaje de Recovery
          </span>
        </div>
        <p style={{
          fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)',
          lineHeight: 1.55, margin: 0,
        }}>
          {rendered}
        </p>
      </div>

      {/* Coupon */}
      <div style={{
        background: `linear-gradient(135deg, ${T.coral}20, ${T.teal}20)`,
        border: `1px dashed ${T.coral}50`,
        borderRadius: 12, padding: '14px',
        textAlign: 'center',
      }}>
        <div style={{ marginBottom: 6 }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            Código de cupón
          </span>
        </div>
        <div style={{
          fontSize: '1.1rem', fontWeight: 900, color: T.teal,
          letterSpacing: '0.12em', fontFamily: 'monospace',
          textShadow: `0 0 20px ${T.teal}40`,
        }}>
          {sampleCode}
        </div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 8 }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700,
            background: offerTypeBadge.color + '30',
            color: offerTypeBadge.color,
            borderRadius: 999, padding: '3px 9px',
          }}>
            {offerTypeBadge.label}
          </span>
          <span style={{
            fontSize: '0.65rem', fontWeight: 600,
            color: 'rgba(255,255,255,0.35)',
          }}>
            · válido {config.validity_days || 30}d
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Stats card ───────────────────────────────────────────────────────────────
function RecoveryStats({ tenantId }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!tenantId) return;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    supabase
      .from('feedbacks')
      .select('recovery_sent, score')
      .eq('tenant_id', tenantId)
      .gte('created_at', since.toISOString())
      .then(({ data }) => {
        if (!data) return;
        const total    = data.length;
        const sent     = data.filter(f => f.recovery_sent).length;
        const unhappy  = data.filter(f => f.score <= 2).length;
        const rate     = unhappy > 0 ? Math.round((sent / unhappy) * 100) : 0;
        const revenue  = Math.round(sent * 350 * 2.5);
        setStats({ sent, unhappy, rate, revenue, total });
      });
  }, [tenantId]);

  if (!stats) return null;

  const items = [
    { label: 'Enviados (30d)', value: stats.sent, color: T.coral },
    { label: 'Recovery rate', value: `${stats.rate}%`, color: stats.rate >= 50 ? T.green : T.amber },
    { label: 'Ingreso estimado', value: `$${stats.revenue.toLocaleString('es-MX')} MXN`, color: T.teal },
  ];

  return (
    <div style={{
      background: T.card, borderRadius: 16, border: `1px solid ${T.border}`,
      padding: '20px 24px', marginTop: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <TrendingUp size={16} color={T.coral} />
        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: T.ink }}>
          Estadísticas de Recovery (últimos 30 días)
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {items.map(({ label, value, color }) => (
          <div key={label} style={{
            background: color + '08', borderRadius: 12,
            padding: '14px 16px',
            border: `1px solid ${color}20`,
          }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: T.muted, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: '0.75rem', color: T.muted }}>
        Estimado: {stats.sent} cupones × $350 ticket × 2.5× LTV
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RecoverySettings() {
  const { tenant } = useTenant();
  const [config,  setConfig]  = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (tenant?.id) loadConfig();
  }, [tenant?.id]);

  const loadConfig = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('recovery_config')
      .select('*')
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    if (err) console.error(err);
    if (data) {
      setConfig({ ...DEFAULT_CONFIG, ...data });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('recovery_config')
      .upsert({ ...config, tenant_id: tenant.id, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' });
    if (err) {
      setError(err.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const showValueInput = config.offer_type !== 'free_item' && config.offer_type !== 'custom';

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 10, color: T.muted, fontFamily: font }}>
        <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Cargando configuración…</span>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: font, padding: 28, background: T.bg, minHeight: '100vh' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Recovery &amp; Cupones
          </h1>
          <p style={{ fontSize: '0.85rem', color: T.muted, fontWeight: 500 }}>
            Configura la oferta automática para clientes insatisfechos
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: saved ? T.green : T.coral,
            color: '#fff', border: 'none', borderRadius: 12,
            padding: '10px 22px', fontFamily: font, fontWeight: 700,
            fontSize: '0.88rem', cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {saving ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> :
           saved   ? <CheckCircle2 size={15} /> : <Gift size={15} />}
          {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar configuración'}
        </button>
      </div>

      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: '0.85rem', color: T.red,
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

        {/* LEFT: Settings form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Enable toggle */}
          <div style={{
            background: T.card, borderRadius: 20, border: `1px solid ${T.border}`,
            padding: '20px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, color: T.ink, fontSize: '0.92rem' }}>Activar Recovery automático</div>
                <div style={{ fontSize: '0.78rem', color: T.muted, marginTop: 2 }}>
                  Envía un mensaje con oferta cuando la calificación sea baja
                </div>
              </div>
              <button
                onClick={() => update('enabled', !config.enabled)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: config.enabled ? T.teal : T.muted,
                  display: 'flex', alignItems: 'center',
                }}
              >
                {config.enabled
                  ? <CheckCircle2 size={32} color={T.teal} />
                  : <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: T.border }} />
                    </div>
                }
              </button>
            </div>

            {/* Trigger score */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: T.muted,
                textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>
                Enviar si la calificación es ≤
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3].map(s => (
                  <button
                    key={s}
                    onClick={() => update('trigger_score', s)}
                    style={{
                      padding: '8px 20px', borderRadius: 10,
                      border: `2px solid ${config.trigger_score === s ? T.coral : T.border}`,
                      background: config.trigger_score === s ? T.coral + '10' : '#fff',
                      color: config.trigger_score === s ? T.coral : T.muted,
                      fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: font,
                    }}
                  >
                    {'★'.repeat(s)} {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Offer type */}
          <div style={{
            background: T.card, borderRadius: 20, border: `1px solid ${T.border}`,
            padding: '20px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: T.muted,
              textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 12 }}>
              Tipo de oferta
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {OFFER_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => update('offer_type', value)}
                  style={{
                    padding: '12px 16px', borderRadius: 12,
                    border: `2px solid ${config.offer_type === value ? T.purple : T.border}`,
                    background: config.offer_type === value ? T.purple + '08' : '#fff',
                    cursor: 'pointer', textAlign: 'left', fontFamily: font,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <Icon size={16} color={config.offer_type === value ? T.purple : T.muted} />
                  <span style={{
                    fontSize: '0.82rem', fontWeight: 600,
                    color: config.offer_type === value ? T.purple : T.ink,
                  }}>{label}</span>
                </button>
              ))}
            </div>

            {/* Value + Description */}
            <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
              {showValueInput && (
                <div style={{ flex: '0 0 120px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: T.muted, display: 'block', marginBottom: 6 }}>
                    {config.offer_type === 'percentage' ? 'Porcentaje (%)' : 'Monto (MXN)'}
                  </label>
                  <input
                    type="number"
                    value={config.offer_value}
                    onChange={e => update('offer_value', parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 10,
                      border: `1px solid ${T.border}`, fontFamily: font,
                      fontSize: '0.88rem', color: T.ink, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: T.muted, display: 'block', marginBottom: 6 }}>
                  Descripción de la oferta
                </label>
                <input
                  type="text"
                  value={config.offer_description}
                  onChange={e => update('offer_description', e.target.value)}
                  placeholder="ej. 20% de descuento en tu próxima visita"
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 10,
                    border: `1px solid ${T.border}`, fontFamily: font,
                    fontSize: '0.88rem', color: T.ink, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Coupon settings */}
          <div style={{
            background: T.card, borderRadius: 20, border: `1px solid ${T.border}`,
            padding: '20px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Settings size={15} color={T.muted} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: T.muted,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Configuración del cupón
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: T.muted, display: 'block', marginBottom: 6 }}>
                  Prefijo del código
                </label>
                <input
                  type="text"
                  value={config.coupon_prefix}
                  onChange={e => update('coupon_prefix', e.target.value.toUpperCase())}
                  placeholder="RECOVERY"
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 10,
                    border: `1px solid ${T.border}`, fontFamily: font,
                    fontSize: '0.88rem', color: T.ink, outline: 'none', boxSizing: 'border-box',
                    fontWeight: 700, letterSpacing: '0.05em',
                  }}
                />
                <div style={{ marginTop: 5, fontSize: '0.7rem', color: T.muted }}>
                  Ej: {config.coupon_prefix || 'RECOVERY'}-X3K9A
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: T.muted, display: 'block', marginBottom: 6 }}>
                  Validez (días)
                </label>
                <input
                  type="number"
                  value={config.validity_days}
                  onChange={e => update('validity_days', parseInt(e.target.value, 10) || 1)}
                  min={1}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 10,
                    border: `1px solid ${T.border}`, fontFamily: font,
                    fontSize: '0.88rem', color: T.ink, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Message template */}
          <div style={{
            background: T.card, borderRadius: 20, border: `1px solid ${T.border}`,
            padding: '20px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <MessageSquare size={15} color={T.muted} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: T.muted,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Mensaje
              </span>
            </div>
            <div style={{ marginBottom: 10, fontSize: '0.75rem', color: T.muted }}>
              Variables disponibles:{' '}
              {['{{oferta}}', '{{codigo}}', '{{dias}}', '{{negocio}}'].map(v => (
                <code key={v} style={{
                  background: T.purple + '12', color: T.purple,
                  borderRadius: 5, padding: '1px 6px', marginRight: 5,
                  fontFamily: 'monospace', fontSize: '0.78rem',
                }}>{v}</code>
              ))}
            </div>
            <textarea
              value={config.message_template}
              onChange={e => update('message_template', e.target.value)}
              rows={4}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 12,
                border: `1px solid ${T.border}`, fontFamily: font,
                fontSize: '0.85rem', color: T.ink, resize: 'vertical',
                outline: 'none', lineHeight: 1.6, boxSizing: 'border-box',
              }}
            />
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: T.muted, display: 'block', marginBottom: 6 }}>
                Términos y condiciones (opcional)
              </label>
              <textarea
                value={config.terms}
                onChange={e => update('terms', e.target.value)}
                rows={2}
                placeholder="Válido una vez por cliente. No acumulable con otras promociones."
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 10,
                  border: `1px solid ${T.border}`, fontFamily: font,
                  fontSize: '0.82rem', color: T.muted, resize: 'vertical',
                  outline: 'none', lineHeight: 1.5, boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Stats */}
          <RecoveryStats tenantId={tenant?.id} />
        </div>

        {/* RIGHT: Live preview */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} color={T.coral} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: T.muted,
              textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Vista previa en vivo
            </span>
          </div>

          {config.enabled ? (
            <PhonePreview config={config} tenantName={tenant?.name} />
          ) : (
            <div style={{
              background: T.card, borderRadius: 20, border: `1px solid ${T.border}`,
              padding: '48px 24px', textAlign: 'center',
            }}>
              <AlertCircle size={32} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: '0.85rem', color: T.muted, fontWeight: 500 }}>
                Recovery desactivado.<br />Actívalo para ver la vista previa.
              </div>
            </div>
          )}

          {config.enabled && (
            <div style={{
              marginTop: 14, background: T.teal + '10',
              border: `1px solid ${T.teal}30`, borderRadius: 14,
              padding: '12px 16px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <CheckCircle2 size={16} color={T.teal} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: '0.78rem', color: T.ink, lineHeight: 1.5 }}>
                <strong>Activo</strong> · Trigger ≤ {config.trigger_score}★ ·{' '}
                Válido {config.validity_days} días
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
