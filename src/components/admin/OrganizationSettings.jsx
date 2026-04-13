import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { PLAN_LIMITS, getEffectivePrice } from '../../config/planLimits';
import { loadStripe } from '@stripe/stripe-js';
import { Save, CheckCircle2, Zap, Building2, Star, AlertTriangle, RotateCcw, FlaskConical, Rocket, MessageSquare, Loader, HelpCircle, ExternalLink } from 'lucide-react';

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
  const [saving, setSaving]       = useState(false);
  const [upgrading, setUpgrading] = useState(null);
  const [saved, setSaved]         = useState(false);
  const [usage, setUsage]   = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    if (tenant?.id) fetchUsage();
  }, [tenant?.id, tenant?.whatsapp_number]);

  const fetchUsage = async () => {
    setLoadingUsage(true);
    const period = new Date().toISOString().slice(0, 7);
    const { data } = await supabase
      .from('tenant_whatsapp_usage')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('period', period)
      .maybeSingle();
    setUsage(data);
    setLoadingUsage(false);
  };
  const [resetting, setResetting]       = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [togglingTest, setTogglingTest] = useState(false);
  const [goingLive, setGoingLive]       = useState(false);
  const [liveConfirm, setLiveConfirm]   = useState(false);
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
    const cleanNumber = form.whatsapp_number.replace(/\D/g, '');
    await supabase.from('tenants').update({
      name:               form.name,
      google_review_url:  form.google_review_url,
      whatsapp_number:    cleanNumber,
    }).eq('id', tenant.id);

    // Also update all locations with the same defaults
    await supabase.from('locations')
      .update({
        google_review_url: form.google_review_url,
        whatsapp_number:   cleanNumber,
      })
      .eq('tenant_id', tenant.id);


    await refresh();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const [testing, setTesting] = useState(false);
  const testWhatsApp = async () => {
    const cleanNum = form.whatsapp_number.replace(/\D/g, '');
    if (!cleanNum) {
      alert('Por favor, ingresa el número del manager primero.');
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-alert', {
        body: {
          tenant_id: tenant.id,
          location_id: '00000000-0000-0000-0000-000000000000',
          qr_label: 'Configuración',
          score: 1,
          comment: '👋 ¡Hola! Este es un mensaje de prueba de Retelio. Tu configuración de alertas es correcta.',
          whatsapp_number: cleanNum,
        }
      });
      if (error) throw error;
      alert('¡Mensaje de prueba enviado! Revisa tu WhatsApp.');
    } catch (err) {
      console.error(err);
      alert('Error al enviar prueba: ' + (err.message || 'Error desconocido'));
    } finally {
      setTesting(false);
    }
  };


  const handleToggleTestMode = async () => {
    if (!tenant?.id) return;
    setTogglingTest(true);
    const next = !tenant.test_mode;
    await supabase.from('tenants').update({ test_mode: next }).eq('id', tenant.id);
    await refresh();
    setTogglingTest(false);
  };

  const handleGoLive = async () => {
    if (!tenant?.id) return;
    setGoingLive(true);
    try {
      // Delete all test feedback for this tenant
      await supabase.from('feedbacks').delete().eq('tenant_id', tenant.id).eq('is_test', true);
      // Turn off test mode
      await supabase.from('tenants').update({ test_mode: false }).eq('id', tenant.id);
      await refresh();
      setLiveConfirm(false);
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setGoingLive(false);
  };

  const handleReset = async () => {
    if (!tenant?.id) return;
    setResetting(true);
    const tid = tenant.id;
    const errors = [];
    const del = async (table) => {
      const { error } = await supabase.from(table).delete().eq('tenant_id', tid);
      if (error) errors.push(`${table}: ${error.message}`);
    };
    try {
      // Delete all tenant data in dependency order
      await del('feedbacks');
      await del('Feedback');
      await del('Issues');
      await del('Alerts');
      await del('Metas_KPI');
      await del('Area_Preguntas');
      await del('Tienda_Areas');
      await del('Areas_Catalogo');
      await del('Tiendas_Catalogo');
      await del('qr_codes');
      await del('locations');
      // Delete the tenant row entirely so useTenant forces zero UUID on next load
      await supabase.from('tenants').delete().eq('id', tid);
      // Unlink user from tenant so wizard creates a truly fresh one
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('Usuarios').update({ tenant_id: null }).eq('email', user.email);
      }
      if (errors.length) console.warn('Reset partial errors:', errors);
      // Clear all local state and reload
      localStorage.removeItem('onboarding_complete');
      localStorage.removeItem('saas_tenant_config');
      window.location.reload();
    } catch (e) {
      console.error('Reset error:', e);
      alert('Error al reiniciar: ' + e.message);
    }
    setResetting(false);
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
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700,
            color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            WhatsApp del manager
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={form.whatsapp_number}
              onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))}
              placeholder="5215512345678"
              style={{
                flex: 1, border: `1.5px solid ${T.border}`, borderRadius: 10,
                padding: '10px 14px', fontFamily: font, fontSize: '0.95rem', outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = T.coral}
              onBlur={e => e.target.style.borderColor = T.border}
            />
            <button
              onClick={testWhatsApp}
              disabled={testing}
              style={{
                padding: '0 20px', borderRadius: 10, border: 'none',
                background: '#25D366', color: '#fff', fontWeight: 800,
                fontSize: '0.82rem', cursor: 'pointer', fontFamily: font,
                boxShadow: '0 4px 12px rgba(37,211,102,0.25)',
                display: 'flex', alignItems: 'center', gap: 6,
                minWidth: 140, justifyContent: 'center'
              }}
            >
              {testing ? 'Probando...' : <><MessageSquare size={14} /> Probar Alerta</>}
            </button>
          </div>
          <p style={{ fontSize: '0.72rem', color: T.muted, marginTop: 4 }}>
            Sin +, sin espacios. Ej: 5215512345678. Recibirá alertas de feedbacks críticos.
          </p>
        </div>

        {/* Usage Info */}
        <div style={{ 
          background: T.bg, borderRadius: 12, padding: 16, border: `1px solid ${T.border}`,
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: (tenant?.whatsapp_number ? T.teal : T.muted) }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: T.ink, textTransform: 'uppercase' }}>Uso de WhatsApp</span>
            </div>
            {usage && (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted }}>
                {new Date().toLocaleString('es-MX', { month: 'long' })}
              </span>
            )}
          </div>

          {!usage ? (
            <div style={{ fontSize: '0.82rem', color: T.muted }}>
              {loadingUsage ? 'Cargando consumo...' : 'Sin uso registrado este mes.'}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: T.ink }}>
                  {usage.used_count} <span style={{ fontWeight: 500, color: T.muted }}>mensajes enviados</span>
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: T.ink }}>
                  {usage.included_limit === -1 ? '∞' : usage.included_limit + (usage.addon_purchased || 0)}
                </span>
              </div>
              <div style={{ height: 6, background: T.border, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${usage.included_limit === -1 ? 0 : Math.min(100, (usage.used_count / (usage.included_limit + (usage.addon_purchased || 0))) * 100)}%`,
                  background: (usage.used_count / (usage.included_limit + (usage.addon_purchased || 0))) > 0.9 ? T.red : T.teal,
                  borderRadius: 999 
                }} />
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              background: saved ? T.teal : T.ink, color: '#fff', border: 'none',
              borderRadius: 10, padding: '11px 24px', fontFamily: font,
              fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saved ? <><CheckCircle2 size={16} /> Guardado</> : <><Save size={16} /> {saving ? 'Guardando…' : 'Guardar cambios'}</>}
          </button>
          
          <button
            onClick={testWhatsApp}
            disabled={testing}
            style={{
              background: '#fff', color: T.ink, border: `1.5px solid ${T.border}`,
              borderRadius: 10, padding: '11px 20px', fontFamily: font,
              fontWeight: 700, fontSize: '0.9rem', cursor: testing ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.coral}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
          >
            {testing ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <MessageSquare size={16} />}
            Probar Alerta
          </button>
        </div>
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

      {/* ── Modo prueba ── */}
      <div style={{ marginTop: 32, border: `1.5px solid ${tenant?.test_mode ? '#93C5FD' : T.border}`, borderRadius: 14, padding: '20px 24px', background: tenant?.test_mode ? '#EFF6FF' : T.card }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FlaskConical size={18} color={tenant?.test_mode ? '#1D4ED8' : T.muted} />
            <div>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: tenant?.test_mode ? '#1D4ED8' : T.ink, fontFamily: font }}>
                Modo prueba {tenant?.test_mode ? '— ACTIVO' : ''}
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: T.muted, fontFamily: font }}>
                Crea sucursales, áreas, QRs y prueba el flujo completo. El feedback generado se marca como prueba y no contamina tus métricas reales.
              </p>
            </div>
          </div>
          <button onClick={handleToggleTestMode} disabled={togglingTest} style={{
            background: tenant?.test_mode ? '#1D4ED8' : 'white',
            color: tenant?.test_mode ? 'white' : T.ink,
            border: `1.5px solid ${tenant?.test_mode ? '#1D4ED8' : T.border}`,
            borderRadius: 8, padding: '8px 18px', fontFamily: font,
            fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
          }}>
            {togglingTest ? '…' : tenant?.test_mode ? 'Desactivar prueba' : 'Activar modo prueba'}
          </button>
        </div>

        {tenant?.test_mode && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #BFDBFE' }}>
            <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: '#1E40AF', fontFamily: font, fontWeight: 600 }}>
              ¿Listo para salir a producción? Se borrarán todos los feedbacks de prueba. Tu configuración (sucursales, áreas, QRs) se conserva.
            </p>
            {!liveConfirm ? (
              <button onClick={() => setLiveConfirm(true)} style={{
                background: '#1D4ED8', color: 'white', border: 'none',
                borderRadius: 8, padding: '9px 20px', fontFamily: font,
                fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Rocket size={14} /> Salir a producción
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.82rem', color: '#1E40AF', fontFamily: font, fontWeight: 600 }}>¿Confirmas? Se borrará el feedback de prueba.</span>
                <button onClick={handleGoLive} disabled={goingLive} style={{
                  background: '#1D4ED8', color: 'white', border: 'none',
                  borderRadius: 8, padding: '8px 18px', fontFamily: font,
                  fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                }}>
                  {goingLive ? 'Procesando…' : 'Sí, ir a producción'}
                </button>
                <button onClick={() => setLiveConfirm(false)} style={{
                  background: 'white', color: T.muted, border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: '8px 14px', fontFamily: font,
                  fontSize: '0.82rem', cursor: 'pointer',
                }}>Cancelar</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Zona de pruebas ── */}
      <div style={{ marginTop: 32, border: '1.5px solid #FCA5A5', borderRadius: 14, padding: '20px 24px', background: '#FFF5F5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <AlertTriangle size={16} color="#DC2626" />
          <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#DC2626', fontFamily: font }}>Zona de pruebas</h3>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '0.8rem', color: '#7F1D1D', fontFamily: font, lineHeight: 1.5 }}>
          Borra todos los datos (feedback, sucursales, áreas, preguntas) y regresa al onboarding.
          Útil para probar el flujo sin crear correos nuevos. <strong>No se puede deshacer.</strong>
        </p>
        {!resetConfirm ? (
          <button onClick={() => setResetConfirm(true)} style={{
            background: 'white', color: '#DC2626', border: '1.5px solid #FCA5A5',
            borderRadius: 8, padding: '8px 18px', fontFamily: font,
            fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <RotateCcw size={14} /> Reiniciar cuenta
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#7F1D1D', fontFamily: font, fontWeight: 600 }}>¿Confirmas? Se borrarán todos tus datos.</span>
            <button onClick={handleReset} disabled={resetting} style={{
              background: '#DC2626', color: 'white', border: 'none',
              borderRadius: 8, padding: '8px 18px', fontFamily: font,
              fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
            }}>
              {resetting ? 'Reiniciando…' : 'Sí, borrar todo'}
            </button>
            <button onClick={() => setResetConfirm(false)} style={{
              background: 'white', color: T.muted, border: `1px solid ${T.border}`,
              borderRadius: 8, padding: '8px 14px', fontFamily: font,
              fontSize: '0.82rem', cursor: 'pointer',
            }}>
              Cancelar
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
