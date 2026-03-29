/**
 * DistributorApplication.jsx
 * Wizard público para solicitar ser distribuidor.
 * Ruta: /quiero-ser-distribuidor (sin auth requerida)
 */
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight, ChevronLeft, CheckCircle2, Loader, MapPin, Briefcase, Users, Target } from 'lucide-react';

const T = {
  coral: '#FF5C3A', teal: '#00C9A7', ink: '#0D0D12',
  muted: '#6B6B7A', border: '#E8E7E4', bg: '#F5F4F1', card: '#FFFFFF',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const SEGMENTS = [
  { key: 'restaurant', label: '🍽️ Restaurantes' },
  { key: 'hotel',      label: '🏨 Hoteles' },
  { key: 'retail',     label: '🛍️ Retail / Tiendas' },
  { key: 'health',     label: '💊 Farmacias / Salud' },
  { key: 'auto',       label: '🔧 Automotriz / Talleres' },
  { key: 'medical',    label: '🏥 Clínicas / Consultorios' },
  { key: 'services',   label: '⚡ Servicios profesionales' },
  { key: 'edu',        label: '📚 Educación / Escuelas' },
];

const STEPS = [
  { icon: <Briefcase size={18} />, label: 'Sobre ti' },
  { icon: <Users size={18} />,     label: 'Tu red' },
  { icon: <Target size={18} />,    label: 'Mercado' },
  { icon: <CheckCircle2 size={18} />, label: 'Términos' },
];

const EMPTY = {
  name: '', company: '', email: '', whatsapp: '', city: '', state: '',
  experience: '', monthly_visits: '', has_contacts: '', sell_style: '',
  target_segments: [], territory: '', linkedin_url: '',
  terms: false,
};

function ProgressBar({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
      {STEPS.map((s, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: i < step ? T.teal : i === step ? T.coral : T.border,
            color: i <= step ? '#fff' : T.muted, transition: 'all 0.3s',
          }}>
            {i < step ? <CheckCircle2 size={15} /> : s.icon}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: i === step ? T.coral : i < step ? T.teal : T.muted, textAlign: 'center' }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontFamily: "'DM Mono', monospace" }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', required }) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} required={required}
      style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 14, fontFamily: font, color: T.ink, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
      onFocus={e => e.target.style.borderColor = T.coral}
      onBlur={e => e.target.style.borderColor = T.border}
    />
  );
}

function RadioGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(o => (
        <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', border: `1.5px solid ${value === o.value ? T.coral : T.border}`, borderRadius: 10, background: value === o.value ? T.coral + '08' : '#fff', transition: 'all 0.15s' }}>
          <div style={{ width: 16, height: 16, borderRadius: 99, border: `2px solid ${value === o.value ? T.coral : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {value === o.value && <div style={{ width: 8, height: 8, borderRadius: 99, background: T.coral }} />}
          </div>
          <input type="radio" value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} style={{ display: 'none' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{o.label}</div>
            {o.sub && <div style={{ fontSize: 11, color: T.muted }}>{o.sub}</div>}
          </div>
        </label>
      ))}
    </div>
  );
}

// ── Pasos ─────────────────────────────────────────────────────────────────────
function Step1({ form, set }) {
  return (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: T.ink, marginBottom: 6, letterSpacing: '-0.03em' }}>Cuéntanos sobre ti</h2>
      <p style={{ fontSize: 13, color: T.muted, marginBottom: 24, lineHeight: 1.5 }}>Esta información nos ayuda a darte el mejor soporte desde el primer día.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Nombre completo *">
            <TextInput value={form.name} onChange={v => set('name', v)} placeholder="Ej. Carlos Martínez" required />
          </Field>
        </div>
        <Field label="Empresa o marca personal">
          <TextInput value={form.company} onChange={v => set('company', v)} placeholder="Ej. CM Ventas" />
        </Field>
        <Field label="Ciudad">
          <TextInput value={form.city} onChange={v => set('city', v)} placeholder="CDMX" />
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Email *" hint="Te llegará la confirmación y tu acceso al portal">
            <TextInput type="email" value={form.email} onChange={v => set('email', v)} placeholder="carlos@email.com" required />
          </Field>
        </div>
        <Field label="WhatsApp *" hint="Para contacto directo">
          <TextInput value={form.whatsapp} onChange={v => set('whatsapp', v)} placeholder="+52 55 1234 5678" required />
        </Field>
        <Field label="LinkedIn (opcional)">
          <TextInput value={form.linkedin_url} onChange={v => set('linkedin_url', v)} placeholder="linkedin.com/in/carlos" />
        </Field>
      </div>
    </>
  );
}

function Step2({ form, set }) {
  return (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: T.ink, marginBottom: 6, letterSpacing: '-0.03em' }}>Tu red de contactos</h2>
      <p style={{ fontSize: 13, color: T.muted, marginBottom: 24, lineHeight: 1.5 }}>No te pedimos compromisos — solo queremos entender con qué punto de partida cuentas.</p>

      <Field label="¿Con cuántos dueños o encargados de negocios tienes contacto hoy?">
        <RadioGroup
          value={form.has_contacts}
          onChange={v => set('has_contacts', v)}
          options={[
            { value: 'yes_100+', label: 'Más de 100 contactos', sub: 'Tengo una base sólida y activa' },
            { value: 'yes_20-100', label: 'Entre 20 y 100 contactos', sub: 'Conozco a varios dueños de negocio' },
            { value: 'some', label: 'Pocos, pero los conozco bien', sub: 'Calidad sobre cantidad' },
            { value: 'none', label: 'Voy a construirla desde cero', sub: 'Tengo ganas y disposición' },
          ]}
        />
      </Field>

      <Field label="¿Cuántos negocios visitas o contactas en un mes típico?">
        <RadioGroup
          value={form.monthly_visits}
          onChange={v => set('monthly_visits', v)}
          options={[
            { value: '50+', label: '+50 negocios / mes' },
            { value: '21-50', label: '21 a 50 negocios / mes' },
            { value: '6-20', label: '6 a 20 negocios / mes' },
            { value: '1-5', label: '1 a 5 negocios / mes' },
          ]}
        />
      </Field>
    </>
  );
}

function Step3({ form, set }) {
  const toggleSegment = (key) => {
    const curr = form.target_segments;
    set('target_segments', curr.includes(key) ? curr.filter(k => k !== key) : [...curr, key]);
  };

  return (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: T.ink, marginBottom: 6, letterSpacing: '-0.03em' }}>Tu mercado objetivo</h2>
      <p style={{ fontSize: 13, color: T.muted, marginBottom: 24, lineHeight: 1.5 }}>¿A qué tipo de negocios quieres llegar? Selecciona todos los que apliquen.</p>

      <Field label="Giros que quieres atacar *">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: 8 }}>
          {SEGMENTS.map(s => {
            const sel = form.target_segments.includes(s.key);
            return (
              <button key={s.key} type="button" onClick={() => toggleSegment(s.key)}
                style={{ padding: '10px 14px', border: `1.5px solid ${sel ? T.coral : T.border}`, borderRadius: 10, background: sel ? T.coral + '10' : '#fff', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? T.coral : T.ink, fontFamily: font, transition: 'all 0.15s' }}>
                {s.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="¿Cómo describes tu forma de vender hoy?">
        <RadioGroup
          value={form.sell_style}
          onChange={v => set('sell_style', v)}
          options={[
            { value: 'presencial', label: '🚶 Visitas presenciales / puerta a puerta' },
            { value: 'digital',    label: '📱 Redes sociales / marketing digital' },
            { value: 'cross',      label: '🤝 Tengo clientes de otro servicio que puedo cruzar' },
            { value: 'team',       label: '👥 Cuento con equipo de ventas' },
          ]}
        />
      </Field>

      <Field label="¿En qué zona geográfica operas principalmente?" hint="Ciudad, estado o región">
        <TextInput value={form.territory} onChange={v => set('territory', v)} placeholder="Ej. CDMX y área metropolitana, Guadalajara, Noreste…" />
      </Field>
    </>
  );
}

function Step4({ form, set }) {
  const commissionTable = [
    { tier: '🥉 Bronce', clients: '1–5 activos', pct: '15%', bonus: '$200 MXN' },
    { tier: '🥈 Plata',  clients: '6–20 activos', pct: '20%', bonus: '$300 MXN' },
    { tier: '🥇 Oro',    clients: '21+ activos',  pct: '25%', bonus: '$500 MXN' },
  ];

  return (
    <>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: T.ink, marginBottom: 6, letterSpacing: '-0.03em' }}>Esquema de comisiones</h2>
      <p style={{ fontSize: 13, color: T.muted, marginBottom: 20, lineHeight: 1.5 }}>Ganas comisión recurrente cada mes por cada cliente activo que traigas. Entre más clientes, más % de su MRR.</p>

      {/* Commission table */}
      <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', background: T.bg, padding: '8px 14px', minWidth: 380 }}>
          {['Nivel', 'Clientes activos', 'Comisión MRR', 'Bono por alta'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
          ))}
        </div>
        {commissionTable.map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '12px 14px', borderTop: `1px solid ${T.border}`, background: i === 1 ? T.coral + '05' : '#fff', minWidth: 380 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: T.ink }}>{row.tier}</div>
            <div style={{ fontSize: 13, color: T.muted }}>{row.clients}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: T.coral }}>{row.pct}</div>
            <div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{row.bonus}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#F0FDF4', border: '1px solid #C2EDE3', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: '#15803D', lineHeight: 1.6 }}>
        💡 <strong>¿Cómo se calcula?</strong> Si traes 10 clientes en plan Starter ($499 MXN/mes), generas $4,990 MRR. Con nivel Plata (20%), recibes <strong>$998 MXN al mes</strong>, todos los meses que esos clientes sean activos.
      </div>

      {/* Terms */}
      <div style={{ background: T.bg, borderRadius: 10, padding: '14px 16px', marginBottom: 20, fontSize: 12, color: T.muted, lineHeight: 1.7, maxHeight: 140, overflowY: 'auto' }}>
        <strong style={{ color: T.ink }}>Términos y condiciones del programa de distribuidores Retelio</strong><br />
        1. El distribuidor opera de forma independiente y no es empleado de Retelio.<br />
        2. Las comisiones se calculan sobre el MRR neto cobrado al cliente, excluyendo impuestos.<br />
        3. Las comisiones se liquidan dentro de los primeros 15 días del mes siguiente al período correspondiente.<br />
        4. Existe un período de hold de 60 días desde la primera factura de cada cliente nuevo antes del primer pago de comisión.<br />
        5. Retelio se reserva el derecho de modificar el esquema de comisiones con 30 días de aviso previo.<br />
        6. El distribuidor se compromete a no difamar, copiar o competir directamente con Retelio.<br />
        7. La aprobación de la solicitud no garantiza exclusividad territorial.<br />
      </div>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '12px 16px', border: `1.5px solid ${form.terms ? T.teal : T.border}`, borderRadius: 10, background: form.terms ? T.teal + '08' : '#fff', transition: 'all 0.15s' }}>
        <div onClick={() => set('terms', !form.terms)} style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${form.terms ? T.teal : T.border}`, background: form.terms ? T.teal : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, cursor: 'pointer', transition: 'all 0.15s' }}>
          {form.terms && <CheckCircle2 size={14} color="#fff" />}
        </div>
        <span style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
          Leí y acepto los términos y condiciones del programa de distribuidores, incluyendo el esquema de comisiones descrito arriba.
        </span>
      </label>
    </>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export default function DistributorApplication() {
  const [step, setStep]     = useState(0);
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);
  const [err, setErr]       = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canNext = () => {
    if (step === 0) return form.name.trim() && form.email.trim() && form.whatsapp.trim();
    if (step === 1) return form.has_contacts && form.monthly_visits;
    if (step === 2) return form.target_segments.length > 0 && form.sell_style;
    if (step === 3) return form.terms;
    return true;
  };

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const { error } = await supabase.from('distributor_applications').insert({
        name: form.name, company: form.company, email: form.email,
        whatsapp: form.whatsapp, city: form.city,
        experience: form.experience, monthly_visits: form.monthly_visits,
        has_contacts: form.has_contacts, sell_style: form.sell_style,
        target_segments: form.target_segments, territory: form.territory,
        linkedin_url: form.linkedin_url || null,
      });
      if (error) throw error;
      setDone(true);
    } catch (e) {
      setErr('Hubo un error al enviar tu solicitud. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, padding: 24, fontFamily: font }}>
      <div style={{ background: T.card, borderRadius: 20, padding: 48, maxWidth: 460, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.1)' }}>
        <div style={{ width: 64, height: 64, borderRadius: 99, background: T.teal + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle2 size={32} color={T.teal} />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: T.ink, marginBottom: 10 }}>¡Solicitud enviada!</h2>
        <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.6 }}>
          Revisamos tu perfil en las próximas <strong>48 horas</strong>. Si tu solicitud es aprobada, recibirás un correo en <strong>{form.email}</strong> con tus credenciales de acceso y tu código de distribuidor.
        </p>
        <div style={{ marginTop: 24, padding: '14px 18px', background: T.bg, borderRadius: 10, fontSize: 12, color: T.muted }}>
          Mientras tanto, descarga nuestra app o sigue a <strong style={{ color: T.coral }}>@retelio.mx</strong> para conocer más sobre la plataforma.
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, padding: 24, fontFamily: font }}>
      <div style={{ background: T.card, borderRadius: 20, padding: '36px 40px', maxWidth: 560, width: '100%', boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 20px 48px rgba(0,0,0,0.08)' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 6px)', gap: '1.5px' }}>
            {['#FF5C3A','#FF5C3A','#FF5C3A','rgba(255,92,58,0.22)','#FF5C3A','#00C9A7','rgba(255,92,58,0.15)','#FF5C3A','#FF5C3A','#FF5C3A','#FF5C3A','rgba(0,201,167,0.5)','rgba(255,92,58,0.1)','rgba(255,92,58,0.4)','rgba(0,201,167,0.3)','#FF5C3A'].map((c, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: 1, background: c }} />
            ))}
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: '-0.03em' }}>retelio</span>
          <span style={{ fontSize: 11, color: T.muted, fontWeight: 600, background: T.bg, padding: '2px 8px', borderRadius: 99 }}>Programa de Distribuidores</span>
        </div>

        <ProgressBar step={step} total={STEPS.length} />

        {/* Step content */}
        {step === 0 && <Step1 form={form} set={set} />}
        {step === 1 && <Step2 form={form} set={set} />}
        {step === 2 && <Step3 form={form} set={set} />}
        {step === 3 && <Step4 form={form} set={set} />}

        {err && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13, marginTop: 16 }}>
            {err}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, gap: 12 }}>
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: T.muted, display: 'flex', alignItems: 'center', gap: 6, fontFamily: font }}>
              <ChevronLeft size={16} /> Anterior
            </button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} style={{ background: canNext() ? T.coral : T.border, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 800, cursor: canNext() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6, fontFamily: font, transition: 'background 0.15s' }}>
              Siguiente <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={submit} disabled={!canNext() || saving} style={{ background: canNext() ? T.coral : T.border, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 800, cursor: canNext() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 8, fontFamily: font }}>
              {saving ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={15} />}
              {saving ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          )}
        </div>

        <div style={{ marginTop: 20, fontSize: 11, color: T.muted, textAlign: 'center' }}>
          Revisamos todas las solicitudes en 48 horas · <a href="https://retelio.com.mx" style={{ color: T.coral }}>retelio.com.mx</a>
        </div>
      </div>
    </div>
  );
}
