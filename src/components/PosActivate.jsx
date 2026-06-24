import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { Star, CheckCircle, ShieldCheck, TrendingUp, Copy, Download, ArrowRight, ChevronLeft } from 'lucide-react';

const T = {
  coral: '#FF5C3A', teal: '#00C9A7', ink: '#0D0D12',
  muted: '#6B7280', border: '#E5E7EB', bg: '#F7F8FC', card: '#FFFFFF',
  green: '#16A34A', red: '#DC2626',
};

const DISCOUNTS = [
  { value: 10, label: '10% de descuento', description: '10% de descuento en tu próxima visita' },
  { value: 15, label: '15% de descuento', description: '15% de descuento en tu próxima visita' },
  { value: 20, label: '20% de descuento', description: '20% de descuento en tu próxima visita' },
  { value: 0,  label: 'Personalizar',     description: '' },
];

// Activation landing + 3-step wizard for POS-referred stores.
// Entry: /activate?pos=miteindita&store_name=...&phone=...&store_id=...&redirect_uri=...
export default function PosActivate() {
  const params       = new URLSearchParams(window.location.search);
  const pos          = params.get('pos')          ?? 'pos';
  const redirectUri  = params.get('redirect_uri') ?? null;

  const [step, setStep]     = useState(0); // 0=landing 1=info 2=incentive 3=done
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState(null);

  // Form state
  const [form, setForm] = useState({
    store_name:        params.get('store_name') ?? '',
    owner_name:        '',
    phone:             params.get('phone')       ?? '',
    email:             '',
    password:          '',
    google_review_url: '',
  });
  const [discount, setDiscount]         = useState(15);
  const [customDescription, setCustom] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Step 1 validation ───────────────────────────────────────────────────────
  const step1Valid = form.store_name.trim() && form.phone.trim() && form.email.trim() && form.password.length >= 6;

  // ── Activation call ─────────────────────────────────────────────────────────
  async function activate() {
    setLoading(true);
    setError('');
    const chosen   = DISCOUNTS.find(d => d.value === discount);
    const descr    = discount === 0 ? customDescription : chosen?.description ?? '';

    const { data, error: fnErr } = await supabase.functions.invoke('pos-activate', {
      body: {
        pos,
        pos_store_id:         params.get('store_id') ?? null,
        store_name:           form.store_name.trim(),
        owner_name:           form.owner_name.trim() || form.store_name.trim(),
        phone:                form.phone.trim(),
        email:                form.email.trim().toLowerCase(),
        password:             form.password,
        google_review_url:    form.google_review_url.trim() || null,
        discount_pct:         discount || null,
        discount_description: descr || null,
      },
    });

    setLoading(false);
    if (fnErr || data?.error) { setError(data?.error ?? fnErr.message); return; }

    setResult(data);
    setStep(3);

    // Notify POS via postMessage (if inside iframe)
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'retelio:activated', ...data }, '*');
    }

    // Redirect back to POS if redirect_uri provided
    if (redirectUri) {
      const url = new URL(redirectUri);
      url.searchParams.set('embed_token', data.embed_token);
      url.searchParams.set('store_id',    data.store_id);
      url.searchParams.set('api_key',     data.api_key);
      setTimeout(() => window.location.href = url.toString(), 2500);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(result.feedback_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Shared layout wrapper ───────────────────────────────────────────────────
  const Wrap = ({ children, back }) => (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: T.bg, minHeight: '100vh', maxWidth: 440, margin: '0 auto' }}>
      {back && (
        <button onClick={() => { setStep(s => s - 1); setError(''); }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: '0.82rem' }}>
          <ChevronLeft size={15} /> Atrás
        </button>
      )}
      <div style={{ padding: back ? '0 16px 40px' : '0 16px 40px' }}>{children}</div>
    </div>
  );

  const Input = ({ label, value, onChange, type = 'text', placeholder, hint }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: T.ink, marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '11px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: '0.95rem', color: T.ink, outline: 'none', boxSizing: 'border-box', background: T.card }} />
      {hint && <div style={{ fontSize: '0.7rem', color: T.muted, marginTop: 3 }}>{hint}</div>}
    </div>
  );

  const Btn = ({ children, onClick, disabled, secondary }) => (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? T.border : secondary ? T.card : T.coral,
        color: disabled ? T.muted : secondary ? T.coral : '#fff',
        fontWeight: 800, fontSize: '1rem',
        border: secondary ? `2px solid ${T.coral}` : 'none',
      }}>
      {children}
    </button>
  );

  // ── STEP 0: Landing ─────────────────────────────────────────────────────────
  if (step === 0) return (
    <Wrap>
      <div style={{ textAlign: 'center', padding: '48px 0 32px' }}>
        <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>⭐</div>
        <h1 style={{ fontSize: '1.55rem', fontWeight: 900, color: T.ink, lineHeight: 1.25, margin: '0 0 12px' }}>
          Convierte cada venta en una reseña de Google
        </h1>
        <p style={{ fontSize: '0.9rem', color: T.muted, lineHeight: 1.6, margin: '0 0 32px' }}>
          Tus clientes felices van a Google. Los que tuvieron un problema, te avisan primero a ti.
        </p>
      </div>

      {[
        { icon: '🎯', text: 'El cliente escanea el QR de tu ticket o recibe un link por WhatsApp' },
        { icon: '⭐', text: 'Si califica bien → lo mandas directo a Google Reviews' },
        { icon: '🎁', text: 'Si califica mal → te avisamos y le damos un cupón de regreso' },
      ].map(({ icon, text }) => (
        <div key={text} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 18 }}>
          <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: '0.88rem', color: T.ink, lineHeight: 1.5 }}>{text}</span>
        </div>
      ))}

      <div style={{ marginTop: 36 }}>
        <Btn onClick={() => setStep(1)}>Activar mi tienda gratis <ArrowRight size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }} /></Btn>
        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: T.muted, marginTop: 10 }}>
          Sin tarjeta de crédito · Listo en 2 minutos
        </p>
      </div>
    </Wrap>
  );

  // ── STEP 1: Store info ──────────────────────────────────────────────────────
  if (step === 1) return (
    <Wrap back>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '0.72rem', color: T.muted, marginBottom: 4 }}>Paso 1 de 2</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: T.ink, margin: 0 }}>Tu tienda</h2>
      </div>

      <Input label="Nombre de la tienda *" value={form.store_name} onChange={v => set('store_name', v)} placeholder="Tienda Don Pedro" />
      <Input label="Tu nombre" value={form.owner_name} onChange={v => set('owner_name', v)} placeholder="Pedro García" />
      <Input label="WhatsApp / Celular *" value={form.phone} onChange={v => set('phone', v)} placeholder="573001234567" hint="Con código de país, sin espacios ni +" />
      <Input label="Correo electrónico *" value={form.email} onChange={v => set('email', v)} type="email" placeholder="pedro@ejemplo.com" />
      <Input label="Contraseña *" value={form.password} onChange={v => set('password', v)} type="password" placeholder="Mínimo 6 caracteres" />
      <Input label="Link de Google Reviews" value={form.google_review_url} onChange={v => set('google_review_url', v)} placeholder="https://g.page/r/..." hint="Opcional — los clientes felices irán aquí" />

      <div style={{ marginTop: 8 }}>
        <Btn onClick={() => setStep(2)} disabled={!step1Valid}>Siguiente →</Btn>
      </div>
    </Wrap>
  );

  // ── STEP 2: Incentive ───────────────────────────────────────────────────────
  if (step === 2) return (
    <Wrap back>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '0.72rem', color: T.muted, marginBottom: 4 }}>Paso 2 de 2</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: T.ink, margin: 0 }}>Tu incentivo</h2>
        <p style={{ fontSize: '0.85rem', color: T.muted, marginTop: 6 }}>
          Cuando un cliente dé menos de ★★★, ¿qué le ofreces para que regrese?
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {DISCOUNTS.map(d => (
          <button key={d.value} onClick={() => setDiscount(d.value)}
            style={{
              padding: '13px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
              border: `2px solid ${discount === d.value ? T.coral : T.border}`,
              background: discount === d.value ? T.coral + '10' : T.card,
              color: T.ink, fontWeight: discount === d.value ? 700 : 400, fontSize: '0.9rem',
            }}>
            {d.label}
          </button>
        ))}
      </div>

      {discount === 0 && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: T.ink, marginBottom: 5 }}>
            Describe el beneficio
          </label>
          <input value={customDescription} onChange={e => setCustom(e.target.value)}
            placeholder="Ej: Café gratis en tu próxima visita"
            style={{ width: '100%', padding: '11px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: '0.9rem', boxSizing: 'border-box' }} />
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: `1px solid ${T.red}`, borderRadius: 8, padding: '10px 12px', color: T.red, fontSize: '0.83rem', marginBottom: 14 }}>
          {error}
        </div>
      )}

      <Btn onClick={activate} disabled={loading || (discount === 0 && !customDescription.trim())}>
        {loading ? 'Activando...' : '¡Activar mi tienda!'}
      </Btn>
    </Wrap>
  );

  // ── STEP 3: Done ────────────────────────────────────────────────────────────
  if (step === 3 && result) return (
    <Wrap>
      <div style={{ textAlign: 'center', paddingTop: 32, marginBottom: 24 }}>
        <CheckCircle size={48} color={T.green} style={{ marginBottom: 12 }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: T.ink, margin: '0 0 6px' }}>¡Todo listo!</h2>
        <p style={{ fontSize: '0.85rem', color: T.muted }}>
          Imprime este QR y ponlo en tu caja
        </p>
      </div>

      <div style={{ background: T.card, borderRadius: 14, padding: 20, textAlign: 'center', marginBottom: 16, border: `1px solid ${T.border}` }}>
        <QRCodeSVG value={result.feedback_url} size={200} level="H" style={{ display: 'block', margin: '0 auto' }} />
        <div style={{ marginTop: 12, fontSize: '0.75rem', color: T.muted, wordBreak: 'break-all' }}>
          {result.feedback_url}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button onClick={copyLink}
          style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.82rem', color: T.ink, fontWeight: 600 }}>
          <Copy size={14} /> {copied ? '¡Copiado!' : 'Copiar link'}
        </button>
        <a href={result.qr_api_url} download="retelio-qr.png" target="_blank" rel="noopener noreferrer"
          style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1.5px solid ${T.border}`, background: T.card, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.82rem', color: T.ink, fontWeight: 600, textDecoration: 'none' }}>
          <Download size={14} /> Descargar QR
        </a>
      </div>

      {[
        { icon: '🖨️', text: 'Imprime el QR y ponlo junto a la caja' },
        { icon: '📱', text: 'Para domicilios, el sistema envía el link por WhatsApp automáticamente' },
        { icon: '🎁', text: 'Los cupones aparecen en la sección Customer Experience de tu POS' },
      ].map(({ icon, text }) => (
        <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: '0.82rem', color: T.muted, lineHeight: 1.5 }}>{text}</span>
        </div>
      ))}

      {redirectUri && (
        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: T.muted, marginTop: 20 }}>
          Volviendo a tu sistema en un momento...
        </p>
      )}
    </Wrap>
  );

  return null;
}
