import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { PLAN_LIMITS, getEffectivePrice } from '../../config/planLimits';
import { loadStripe } from '@stripe/stripe-js';
import { Save, CheckCircle2, Zap, Building2, Star } from 'lucide-react';

const T = {
  coral:  '#FF5C3A',
  teal:   '#00C9A7',
  purple: '#7C3AED',
  ink:    '#0D0D12',
  muted:  '#6B7280',
  border: '#E5E7EB',
  bg:     '#F7F8FC',
  card:   '#FFFFFF',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const PLAN_ORDER = ['starter', 'growth'];
const PLAN_HIGHLIGHT = 'growth';
const ZONE_LABELS = { mx: 'MXN 🇲🇽', usd: 'USD 🇺🇸', br: 'BRL 🇧🇷' };
const ZONE_SYM    = { mx: '$', usd: '$', br: 'R$' };

export default function OrganizationSettings() {
  const { tenant, refresh } = useTenant();
  const [saving, setSaving]     = useState(false);
  const [upgrading, setUpgrading] = useState(null);
  const [saved, setSaved]       = useState(false);
  const [form, setForm]         = useState({
    name: '', google_review_url: '', whatsapp_number: '',
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        name:               tenant.name              || '',
        google_review_url:  tenant.google_review_url || '',
        whatsapp_number:    tenant.whatsapp_number   || '',
      });
    }
  }, [tenant?.id]);

  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    await supabase.from('tenants').update({
      name:               form.name,
      google_review_url:  form.google_review_url,
      whatsapp_number:    form.whatsapp_number,
    }).eq('id', tenant.id);

    // Also update all locations with the same defaults if they don't have their own
    await supabase.from('locations')
      .update({
        google_review_url: form.google_review_url,
        whatsapp_number:   form.whatsapp_number,
      })
      .eq('tenant_id', tenant.id)
      .is('google_review_url', null);

    await refresh();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleUpgrade = async (planKey) => {
    if (planKey === tenant?.plan) return;
    setUpgrading(planKey);
    try {
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          tenant_id:  tenant.id,
          plan:       planKey,
          user_email: (await supabase.auth.getUser()).data.user?.email,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      alert('Error al iniciar el pago: ' + err.message);
    } finally {
      setUpgrading(null);
    }
  };

  const currentPlan = tenant?.plan    || 'starter';
  const zone        = tenant?.zone    || 'mx';
  const billing     = tenant?.billing || 'monthly';
  const sym         = ZONE_SYM[zone]  || '$';
  const planKeys    = PLAN_ORDER;

  const input = (label, key, placeholder, hint) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700,
        color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </label>
      <input
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{
          width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10,
          padding: '10px 14px', fontFamily: font, fontSize: '0.95rem', outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={e => e.target.style.borderColor = T.coral}
        onBlur={e => e.target.style.borderColor = T.border}
      />
      {hint && <p style={{ fontSize: '0.72rem', color: T.muted, marginTop: 4 }}>{hint}</p>}
    </div>
  );

  return (
    <div style={{ fontFamily: font, padding: 24, background: T.bg, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: T.ink, marginBottom: 4 }}>
          Configuración
        </h1>
        <p style={{ fontSize: '0.85rem', color: T.muted }}>
          Tu negocio y plan activo
        </p>
      </div>

      {/* Org settings card */}
      <div style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.border}`,
        padding: '24px', marginBottom: 24, maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Building2 size={18} color={T.coral} />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: T.ink }}>Tu negocio</h2>
        </div>

        {input('Nombre del negocio', 'name', 'Ej: Restaurante El Fogón')}
        {input(
          'URL de Google Reviews',
          'google_review_url',
          'https://g.page/r/TU-LUGAR/review',
          'Clientes con ≥4★ serán redirigidos aquí. Encuéntrala en Google Maps → Compartir → Copia el enlace de reseñas.'
        )}
        {input(
          'WhatsApp del manager',
          'whatsapp_number',
          '5215512345678',
          'Sin +, sin espacios. Ej: 5215512345678. Recibirá alertas de feedbacks críticos.'
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saved ? T.teal : T.ink, color: '#fff', border: 'none',
            borderRadius: 10, padding: '11px 24px', fontFamily: font,
            fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saved ? <><CheckCircle2 size={16} /> Guardado</> : <><Save size={16} /> {saving ? 'Guardando…' : 'Guardar cambios'}</>}
        </button>
      </div>

      {/* Plans */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Star size={18} color={T.coral} />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: T.ink }}>Plan activo</h2>
        </div>
        {/* Billing + zone toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: T.border, borderRadius: 8, padding: 2, gap: 2 }}>
            {['monthly','annual'].map(b => (
              <button key={b} onClick={async () => {
                await supabase.from('tenants').update({ billing: b }).eq('id', tenant.id);
                await refresh();
              }} style={{
                padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontFamily: font, fontSize: 12, fontWeight: 700,
                background: billing === b ? T.ink : 'transparent',
                color: billing === b ? '#fff' : T.muted,
              }}>
                {b === 'monthly' ? 'Mensual' : 'Anual −20%'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', background: T.border, borderRadius: 8, padding: 2, gap: 2 }}>
            {Object.entries(ZONE_LABELS).map(([z, label]) => (
              <button key={z} onClick={async () => {
                await supabase.from('tenants').update({ zone: z }).eq('id', tenant.id);
                await refresh();
              }} style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontFamily: font, fontSize: 12, fontWeight: 700,
                background: zone === z ? T.ink : 'transparent',
                color: zone === z ? '#fff' : T.muted,
              }}>
                {label}
              </button>
            ))}
          </div>
          {tenant?.mrr > 0 && (
            <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>
              MRR: <strong style={{ color: T.teal }}>{sym}{tenant.mrr.toLocaleString()}</strong>
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {planKeys.map(key => {
          const plan = PLAN_LIMITS[key];
          const isCurrent = currentPlan === key;
          const isHighlight = key === PLAN_HIGHLIGHT && !isCurrent;
          const isLoading = upgrading === key;

          return (
            <div key={key} style={{
              background: T.card, borderRadius: 16,
              border: isCurrent
                ? `2px solid ${T.coral}`
                : isHighlight ? `2px solid ${T.teal}` : `1px solid ${T.border}`,
              padding: '20px', display: 'flex', flexDirection: 'column',
              position: 'relative', overflow: 'hidden',
            }}>
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  background: T.coral, color: '#fff', borderRadius: 999,
                  padding: '2px 10px', fontSize: '0.65rem', fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>Tu plan</div>
              )}
              {isHighlight && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  background: T.teal, color: '#fff', borderRadius: 999,
                  padding: '2px 10px', fontSize: '0.65rem', fontWeight: 800,
                }}>Popular</div>
              )}

              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: isCurrent ? T.coral : T.ink,
                  marginBottom: 4 }}>{plan.name}</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: '1.7rem', fontWeight: 800, color: T.ink }}>
                    {sym}{getEffectivePrice(zone, key, billing).toLocaleString()}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: T.muted }}>/suc/mes</span>
                </div>
              </div>

              <div style={{ flex: 1, marginBottom: 16 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start',
                    marginBottom: 8, fontSize: '0.8rem', color: '#374151' }}>
                    <CheckCircle2 size={13} color={isCurrent ? T.coral : T.teal}
                      style={{ marginTop: 2, flexShrink: 0 }} />
                    {f}
                  </div>
                ))}
              </div>

              <button
                disabled={isCurrent || !!upgrading}
                onClick={() => handleUpgrade(key)}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                  fontFamily: font, fontWeight: 700, fontSize: '0.82rem', cursor: isCurrent ? 'default' : 'pointer',
                  background: isCurrent ? '#F3F4F6' : isHighlight ? T.teal : T.ink,
                  color: isCurrent ? T.muted : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: upgrading && !isLoading ? 0.5 : 1,
                }}
              >
                {isCurrent ? 'Plan actual'
                  : isLoading ? 'Redirigiendo…'
                  : <><Zap size={14} fill="currentColor" /> Elegir {plan.name}</>}
              </button>
            </div>
          );
        })}
      </div>

      {/* Enterprise banner */}
      <div style={{
        background: T.ink, borderRadius: 16, padding: '24px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: T.teal,
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Enterprise · Premium
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            Grupos grandes · Automotriz · Hoteles · Salud
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#9CA3AF' }}>
            Cotización a medida · White-label · API + webhooks · Account manager · SLA 99.9%
          </p>
        </div>
        <a href="mailto:hola@retelio.com.mx" style={{ textDecoration: 'none' }}>
          <button style={{
            background: '#fff', color: T.ink, border: 'none', borderRadius: 10,
            padding: '10px 24px', fontFamily: font, fontWeight: 800, fontSize: '0.88rem',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            Solicitar cotización →
          </button>
        </a>
      </div>

    </div>
  );
}
