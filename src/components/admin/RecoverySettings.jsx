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

const REWARD_TYPES = [
  { value: 'discount',    emoji: '🏷️', label: 'Descuento' },
  { value: 'merchandise', emoji: '🎁', label: 'Mercancía' },
  { value: 'event',       emoji: '🎫', label: 'Evento' },
  { value: 'experience',  emoji: '✨', label: 'Experiencia' },
];

const DEFAULT = {
  enabled:               true,
  trigger_score:         2,
  offer_type:            'percentage',
  offer_value:           20,
  offer_description:     '20% de descuento en tu próxima visita',
  coupon_prefix:         'RECOVERY',
  validity_days:         30,
  reward_type:           'discount',
  reward_value:          0,
  terms:                 '',
  message_template:      'Hola, lamentamos tu experiencia. Como muestra de aprecio: {{oferta}}. Código: {{codigo}} · válido {{dias}} días. — {{negocio}}',
  loyalty_enabled:        false,
  loyalty_offer_type:     'percentage',
  loyalty_offer_value:    10,
  loyalty_offer_description: '10% de descuento en tu próxima visita',
  loyalty_coupon_prefix:  'LOYAL',
  loyalty_validity_days:  30,
  loyalty_reward_type:    'discount',
  loyalty_reward_value:   0,
  loyalty_trigger_min:    4,
};

const genPreview = (prefix) => `${prefix || 'CODE'}-X3K9A`;

const labelStyle = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700, color: T.muted,
  textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6,
};
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`,
  fontFamily: font, fontSize: '0.88rem', color: T.ink, outline: 'none',
  boxSizing: 'border-box', transition: 'border-color .15s',
};

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

// ─── Shared card shell ────────────────────────────────────────────────────────
function CardShell({ title, emoji, subtitle, accentColor, enabled, onToggle, children }) {
  return (
    <div style={{
      background: T.card, borderRadius: 20, border: `1.5px solid ${enabled ? accentColor + '40' : T.border}`,
      overflow: 'hidden', transition: 'border-color .2s',
      opacity: enabled ? 1 : 0.75,
    }}>
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
          <Toggle on={enabled} onChange={onToggle} />
        </div>
      </div>
      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Coupon preview strip ──────────────────────────────────────────────────────
function CouponPreview({ prefix, validityDays, description, accentColor }) {
  return (
    <div style={{
      background: '#0D0D12', borderRadius: 12, padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: '0.6rem', color: T.teal, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 3 }}>
          Vista previa
        </div>
        <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.1rem', color: '#fff', letterSpacing: '0.08em' }}>
          {genPreview(prefix)}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
          válido {validityDays} días
        </div>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: accentColor, marginTop: 2 }}>
          {description?.slice(0, 28) || '—'}{description?.length > 28 ? '…' : ''}
        </div>
      </div>
    </div>
  );
}

// ─── Recovery coupon card (all fields hardcoded — no fields object) ────────────
function RecoveryCouponCard({ config, onChange }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const enabled = config['enabled'];
  const rewardType = config['reward_type'] || 'discount';

  return (
    <CardShell
      title="Recovery"
      emoji="😔"
      subtitle="Se activa cuando el cliente da una mala calificación"
      accentColor={T.coral}
      enabled={enabled}
      onToggle={v => onChange('enabled', v)}
    >
      {/* Reward type */}
      <div>
        <label style={labelStyle}>Tipo de incentivo</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {REWARD_TYPES.map(rt => (
            <button key={rt.value} onClick={() => onChange('reward_type', rt.value)} style={{
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              border: `1.5px solid ${rewardType === rt.value ? T.coral : T.border}`,
              background: rewardType === rt.value ? T.coral + '10' : '#fff',
              fontSize: '0.78rem', fontWeight: 700, fontFamily: font,
              color: rewardType === rt.value ? T.coral : T.muted,
            }}>
              {rt.emoji} {rt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Offer description */}
      <div>
        <label style={labelStyle}>
          {rewardType !== 'discount' ? 'Descripción del premio' : 'Descripción de la oferta'}
        </label>
        <input
          type="text"
          value={config['offer_description']}
          onChange={e => onChange('offer_description', e.target.value)}
          placeholder={rewardType !== 'discount' ? 'ej. Gorra exclusiva BMW' : 'ej. 20% de descuento en tu próxima visita'}
          style={inputStyle}
        />
      </div>

      {/* Reward value — only for non-discount */}
      {rewardType !== 'discount' && (
        <div>
          <label style={labelStyle}>Valor estimado ($) — para calcular ROI</label>
          <input
            type="number" min={0}
            value={config['reward_value'] ?? ''}
            onChange={e => onChange('reward_value', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
            onFocus={e => { if (!config['reward_value']) e.target.select(); }}
            style={inputStyle}
          />
        </div>
      )}

      {/* Prefix + validity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Prefijo del código</label>
          <input
            type="text"
            value={config['coupon_prefix']}
            onChange={e => onChange('coupon_prefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="RECOVERY"
            style={{ ...inputStyle, fontWeight: 700, letterSpacing: '0.05em' }}
          />
        </div>
        <div>
          <label style={labelStyle}>Validez (días)</label>
          <input
            type="number" min={1}
            value={config['validity_days']}
            onChange={e => onChange('validity_days', parseInt(e.target.value) || 1)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Preview */}
      <CouponPreview
        prefix={config['coupon_prefix']}
        validityDays={config['validity_days']}
        description={config['offer_description']}
        accentColor={T.coral}
      />

      {/* Trigger score — recovery: ≤ 1, 2, or 3 stars */}
      <div>
        <label style={labelStyle}>Activar cuando calificación sea ≤</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3].map(s => (
            <button key={s} onClick={() => onChange('trigger_score', s)} style={{
              padding: '7px 18px', borderRadius: 10, fontFamily: font, fontWeight: 700,
              fontSize: '0.82rem', cursor: 'pointer',
              border: `2px solid ${config['trigger_score'] === s ? T.coral : T.border}`,
              background: config['trigger_score'] === s ? T.coral + '10' : '#fff',
              color: config['trigger_score'] === s ? T.coral : T.muted,
            }}>
              {'★'.repeat(s)} {s}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced: message template */}
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
                value={config['message_template']}
                onChange={e => onChange('message_template', e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
            <div>
              <label style={labelStyle}>Términos y condiciones (opcional)</label>
              <textarea
                value={config['terms'] || ''}
                onChange={e => onChange('terms', e.target.value)}
                rows={2}
                placeholder="Válido una vez por cliente. No acumulable."
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
          </div>
        )}
      </div>
    </CardShell>
  );
}

// ─── Loyalty coupon card (hardcoded keys — no fields object) ───────────────────
function LoyaltyCouponCard({ config, onChange }) {
  const enabled = config['loyalty_enabled'];
  const rewardType = config['loyalty_reward_type'] || 'discount';

  return (
    <CardShell
      title="Lealtad"
      emoji="🌟"
      subtitle="Se activa cuando el cliente da una buena calificación"
      accentColor={T.teal}
      enabled={enabled}
      onToggle={v => onChange('loyalty_enabled', v)}
    >
      {/* Reward type */}
      <div>
        <label style={labelStyle}>Tipo de incentivo</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {REWARD_TYPES.map(rt => (
            <button key={rt.value} onClick={() => onChange('loyalty_reward_type', rt.value)} style={{
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              border: `1.5px solid ${rewardType === rt.value ? T.teal : T.border}`,
              background: rewardType === rt.value ? T.teal + '10' : '#fff',
              fontSize: '0.78rem', fontWeight: 700, fontFamily: font,
              color: rewardType === rt.value ? T.teal : T.muted,
            }}>
              {rt.emoji} {rt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Offer description */}
      <div>
        <label style={labelStyle}>
          {rewardType !== 'discount' ? 'Descripción del premio' : 'Descripción de la oferta'}
        </label>
        <input
          type="text"
          value={config['loyalty_offer_description']}
          onChange={e => onChange('loyalty_offer_description', e.target.value)}
          placeholder={rewardType !== 'discount' ? 'ej. Gorra exclusiva BMW' : 'ej. 10% de descuento en tu próxima visita'}
          style={inputStyle}
        />
      </div>

      {/* Reward value — only for non-discount */}
      {rewardType !== 'discount' && (
        <div>
          <label style={labelStyle}>Valor estimado ($) — para calcular ROI</label>
          <input
            type="number" min={0}
            value={config['loyalty_reward_value'] ?? ''}
            onChange={e => onChange('loyalty_reward_value', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
            onFocus={e => { if (!config['loyalty_reward_value']) e.target.select(); }}
            style={inputStyle}
          />
        </div>
      )}

      {/* Prefix + validity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Prefijo del código</label>
          <input
            type="text"
            value={config['loyalty_coupon_prefix']}
            onChange={e => onChange('loyalty_coupon_prefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="LOYAL"
            style={{ ...inputStyle, fontWeight: 700, letterSpacing: '0.05em' }}
          />
        </div>
        <div>
          <label style={labelStyle}>Validez (días)</label>
          <input
            type="number" min={1}
            value={config['loyalty_validity_days']}
            onChange={e => onChange('loyalty_validity_days', parseInt(e.target.value) || 1)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Preview */}
      <CouponPreview
        prefix={config['loyalty_coupon_prefix']}
        validityDays={config['loyalty_validity_days']}
        description={config['loyalty_offer_description']}
        accentColor={T.teal}
      />

      {/* Trigger score — loyalty: ≥ 3, 4, or 5 stars */}
      <div>
        <label style={labelStyle}>Activar cuando calificación sea ≥</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[3, 4, 5].map(s => (
            <button key={s} onClick={() => onChange('loyalty_trigger_min', s)} style={{
              padding: '7px 18px', borderRadius: 10, fontFamily: font, fontWeight: 700,
              fontSize: '0.82rem', cursor: 'pointer',
              border: `2px solid ${config['loyalty_trigger_min'] === s ? T.teal : T.border}`,
              background: config['loyalty_trigger_min'] === s ? T.teal + '10' : '#fff',
              color: config['loyalty_trigger_min'] === s ? T.teal : T.muted,
            }}>
              {'★'.repeat(s)} {s}
            </button>
          ))}
        </div>
      </div>
    </CardShell>
  );
}

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
        const sent      = data.filter(f => f.recovery_sent).length;
        const redeemed  = data.filter(f => f.coupon_redeemed).length;
        const happy     = data.filter(f => f.score >= 4 && f.recovery_sent).length;
        setStats({ sent, redeemed, happy });
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

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <RecoveryCouponCard config={config} onChange={update} />
        <LoyaltyCouponCard  config={config} onChange={update} />
      </div>

      {/* Stats */}
      <Stats tenantId={tenant?.id} />
    </div>
  );
}
