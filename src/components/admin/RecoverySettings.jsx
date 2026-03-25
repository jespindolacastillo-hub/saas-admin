import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { CheckCircle2, Loader, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

const T = {
  coral:  '#FF5C3A', teal: '#00C9A7', purple: '#7C3AED', ink: '#0D0D12',
  muted:  '#6B7280', border: '#E5E7EB', bg: '#F7F8FC', card: '#FFFFFF',
  green:  '#16A34A', amber: '#F59E0B', red: '#DC2626',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const DEFAULT = {
  enabled:               true,
  trigger_score:         2,
  offer_type:            'percentage',
  offer_value:           20,
  offer_description:     '20% de descuento en tu próxima visita',
  coupon_prefix:         'RECOVERY',
  validity_days:         30,
  terms:                 '',
  message_template:      'Hola, lamentamos tu experiencia. Como muestra de aprecio: {{oferta}}. Código: {{codigo}} · válido {{dias}} días. — {{negocio}}',
  loyalty_enabled:       false,
  loyalty_offer_type:    'percentage',
  loyalty_offer_value:   10,
  loyalty_offer_description: '10% de descuento en tu próxima visita',
  loyalty_coupon_prefix: 'LOYAL',
  loyalty_validity_days: 30,
};

const genPreview = (prefix) => `${prefix || 'CODE'}-X3K9A`;

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
      background: on ? T.teal : T.border, position: 'relative', transition: 'background .2s', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 3, left: on ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

// ─── Coupon card ──────────────────────────────────────────────────────────────
function CouponCard({ title, emoji, subtitle, accentColor, fields, config, onChange }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const enabled = config[fields.enabled];

  return (
    <div style={{
      background: T.card, borderRadius: 20, border: `1.5px solid ${enabled ? accentColor + '40' : T.border}`,
      overflow: 'hidden', transition: 'border-color .2s',
      opacity: enabled ? 1 : 0.75,
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 22px',
        background: enabled ? accentColor + '08' : T.bg,
        borderBottom: `1px solid ${enabled ? accentColor + '20' : T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.5rem' }}>{emoji}</span>
          <div>
            <div style={{ fontWeight: 800, color: T.ink, fontSize: '0.95rem' }}>{title}</div>
            <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 1 }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: enabled ? accentColor : T.muted }}>
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
          <Toggle on={enabled} onChange={v => onChange(fields.enabled, v)} />
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Offer description — most important field */}
        <div>
          <label style={labelStyle}>Descripción de la oferta</label>
          <input
            type="text"
            value={config[fields.offer_description]}
            onChange={e => onChange(fields.offer_description, e.target.value)}
            placeholder="ej. 20% de descuento en tu próxima visita"
            style={inputStyle}
          />
        </div>

        {/* Prefix + validity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Prefijo del código</label>
            <input
              type="text"
              value={config[fields.coupon_prefix]}
              onChange={e => onChange(fields.coupon_prefix, e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="RECOVERY"
              style={{ ...inputStyle, fontWeight: 700, letterSpacing: '0.05em' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Validez (días)</label>
            <input
              type="number" min={1}
              value={config[fields.validity_days]}
              onChange={e => onChange(fields.validity_days, parseInt(e.target.value) || 1)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Coupon preview */}
        <div style={{
          background: '#0D0D12', borderRadius: 12, padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.6rem', color: T.teal, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>
              Vista previa
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.1rem', color: '#fff', letterSpacing: '0.08em' }}>
              {genPreview(config[fields.coupon_prefix])}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
              válido {config[fields.validity_days]} días
            </div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: accentColor, marginTop: 2 }}>
              {config[fields.offer_description]?.slice(0, 28) || '—'}{config[fields.offer_description]?.length > 28 ? '…' : ''}
            </div>
          </div>
        </div>

        {/* Score trigger */}
        {fields.trigger_score && (
          <div>
            <label style={labelStyle}>Activar cuando calificación sea ≤</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3].map(s => (
                <button key={s} onClick={() => onChange(fields.trigger_score, s)} style={{
                  padding: '7px 18px', borderRadius: 10, fontFamily: font, fontWeight: 700,
                  fontSize: '0.82rem', cursor: 'pointer',
                  border: `2px solid ${config[fields.trigger_score] === s ? accentColor : T.border}`,
                  background: config[fields.trigger_score] === s ? accentColor + '10' : '#fff',
                  color: config[fields.trigger_score] === s ? accentColor : T.muted,
                }}>
                  {'★'.repeat(s)} {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Advanced toggle */}
        {fields.message_template && (
          <div>
            <button onClick={() => setShowAdvanced(v => !v)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: font,
              fontSize: '0.75rem', color: T.muted, display: 'flex', alignItems: 'center', gap: 4, padding: 0,
            }}>
              {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Configuración avanzada (mensaje y términos)
            </button>
            {showAdvanced && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Plantilla de mensaje WhatsApp</label>
                  <div style={{ fontSize: '0.68rem', color: T.muted, marginBottom: 6 }}>
                    Variables:{' '}
                    {['{{oferta}}', '{{codigo}}', '{{dias}}', '{{negocio}}'].map(v => (
                      <code key={v} style={{ background: T.purple + '12', color: T.purple, borderRadius: 4, padding: '1px 5px', marginRight: 4, fontFamily: 'monospace', fontSize: '0.72rem' }}>{v}</code>
                    ))}
                  </div>
                  <textarea
                    value={config[fields.message_template]}
                    onChange={e => onChange(fields.message_template, e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Términos y condiciones (opcional)</label>
                  <textarea
                    value={config.terms || ''}
                    onChange={e => onChange('terms', e.target.value)}
                    rows={2}
                    placeholder="Válido una vez por cliente. No acumulable."
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700, color: T.muted,
  textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6,
};
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`,
  fontFamily: font, fontSize: '0.88rem', color: T.ink, outline: 'none',
  boxSizing: 'border-box', transition: 'border-color .15s',
};

// ─── Stats ────────────────────────────────────────────────────────────────────
function Stats({ tenantId }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (!tenantId) return;
    const since = new Date(); since.setDate(since.getDate() - 30);
    supabase.from('feedbacks').select('recovery_sent, coupon_redeemed, score')
      .eq('tenant_id', tenantId).gte('created_at', since.toISOString())
      .then(({ data }) => {
        if (!data) return;
        const unhappy   = data.filter(f => f.score <= 2).length;
        const sent      = data.filter(f => f.recovery_sent).length;
        const redeemed  = data.filter(f => f.coupon_redeemed).length;
        const happy     = data.filter(f => f.score >= 4 && f.recovery_sent).length;
        setStats({ unhappy, sent, redeemed, happy });
      });
  }, [tenantId]);

  if (!stats) return null;
  const items = [
    { label: 'Recovery enviados (30d)', value: stats.sent,     color: T.coral  },
    { label: 'Cupones canjeados',       value: stats.redeemed, color: T.green  },
    { label: 'Lealtad enviados (30d)',  value: stats.happy,    color: T.teal   },
  ];
  return (
    <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <TrendingUp size={15} color={T.coral} />
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: T.ink }}>Estadísticas (últimos 30 días)</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {items.map(({ label, value, color }) => (
          <div key={label} style={{ background: color + '08', borderRadius: 12, padding: '14px 16px', border: `1px solid ${color}20` }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: T.muted, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function RecoverySettings() {
  const { tenant } = useTenant();
  const [config, setConfig]   = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => { if (tenant?.id) load(); }, [tenant?.id]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('recovery_config').select('*').eq('tenant_id', tenant.id).maybeSingle();
    if (data) setConfig({ ...DEFAULT, ...data });
    setLoading(false);
  };

  const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true); setError(null);
    const { error: err } = await supabase.from('recovery_config')
      .upsert({ ...config, tenant_id: tenant.id, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' });
    if (err) setError(err.message);
    else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    setSaving(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 10, color: T.muted, fontFamily: font }}>
      <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const recoveryFields = {
    enabled:           'enabled',
    trigger_score:     'trigger_score',
    offer_description: 'offer_description',
    coupon_prefix:     'coupon_prefix',
    validity_days:     'validity_days',
    message_template:  'message_template',
  };

  const loyaltyFields = {
    enabled:           'loyalty_enabled',
    trigger_score:     null, // auto on happy score, no trigger needed
    offer_description: 'loyalty_offer_description',
    coupon_prefix:     'loyalty_coupon_prefix',
    validity_days:     'loyalty_validity_days',
    message_template:  null,
  };

  return (
    <div style={{ fontFamily: font, padding: '28px 32px', maxWidth: 860, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: T.ink, marginBottom: 4 }}>Cupones</h1>
          <p style={{ fontSize: '0.82rem', color: T.muted }}>
            Configura los cupones de recovery (clientes insatisfechos) y lealtad (clientes felices)
          </p>
        </div>
        <button onClick={handleSave} disabled={saving} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: saved ? T.green : T.coral, color: '#fff', border: 'none',
          borderRadius: 12, padding: '10px 22px', fontFamily: font, fontWeight: 700,
          fontSize: '0.88rem', cursor: saving ? 'not-allowed' : 'pointer', transition: 'background .2s',
        }}>
          {saving ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> :
           saved   ? <CheckCircle2 size={15} /> : null}
          {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar cambios'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: '0.85rem', color: T.red }}>
          {error}
        </div>
      )}

      {/* Two coupon cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <CouponCard
          title="Recovery"
          emoji="😔"
          subtitle="Se activa cuando el cliente da una mala calificación"
          accentColor={T.coral}
          fields={recoveryFields}
          config={config}
          onChange={update}
        />
        <CouponCard
          title="Lealtad"
          emoji="🌟"
          subtitle="Se activa cuando el cliente da una buena calificación"
          accentColor={T.teal}
          fields={loyaltyFields}
          config={config}
          onChange={update}
        />
      </div>

      {/* Stats */}
      <Stats tenantId={tenant?.id} />
    </div>
  );
}
