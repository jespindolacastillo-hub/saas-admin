import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, Copy, Download, ArrowRight, ChevronLeft } from 'lucide-react';

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

// Entry: /activate?pos=miteindita&store_name=...&phone=...&store_id=...&redirect_uri=...
// Flow: Landing → Google SSO → Store info → Incentive → Done + QR
export default function PosActivate() {
  const params      = new URLSearchParams(window.location.search);
  const pos         = params.get('pos')          ?? 'pos';
  const redirectUri = params.get('redirect_uri') ?? null;

  const [session, setSession] = useState(null);
  const [step, setStep]       = useState(0); // 0=landing 1=info 2=incentive 3=done
  const [loading, setLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState(false);
  const [result, setResult]   = useState(null);

  const [form, setForm] = useState({
    store_name:        params.get('store_name') ?? '',
    owner_name:        '',
    phone:             params.get('phone')       ?? '',
    google_review_url: '',
  });
  const [discount, setDiscount]   = useState(15);
  const [customDesc, setCustom]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Check for existing Google session (e.g. after OAuth redirect back)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        setSession(s);
        // Auto-advance past landing if user just came back from Google OAuth
        setStep(prev => prev === 0 ? 1 : prev);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      if (s && !session) {
        setSession(s);
        setStep(prev => prev === 0 ? 1 : prev);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    setSigningIn(true);
    setError('');
    // Redirect back to the same URL so params are preserved after OAuth
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  }

  async function activate() {
    setLoading(true);
    setError('');
    const chosen = DISCOUNTS.find(d => d.value === discount);
    const descr  = discount === 0 ? customDesc : chosen?.description ?? '';

    const { data, error: fnErr } = await supabase.functions.invoke('pos-activate', {
      body: {
        pos,
        pos_store_id:         params.get('store_id') ?? null,
        store_name:           form.store_name.trim(),
        owner_name:           form.owner_name.trim() || form.store_name.trim(),
        phone:                form.phone.trim(),
        google_review_url:    form.google_review_url.trim() || null,
        discount_pct:         discount || null,
        discount_description: descr || null,
      },
    });

    setLoading(false);
    if (fnErr || data?.error) { setError(data?.error ?? fnErr.message); return; }

    setResult(data);
    setStep(3);

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'retelio:activated', ...data }, '*');
    }
    if (redirectUri) {
      const url = new URL(redirectUri);
      url.searchParams.set('embed_token', data.embed_token);
      url.searchParams.set('store_id',    data.store_id);
      url.searchParams.set('api_key',     data.api_key);
      setTimeout(() => window.location.href = url.toString(), 2500);
    }
  }

  const step1Valid = form.store_name.trim() && form.phone.trim();

  const Wrap = ({ children, back }) => (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: T.bg, minHeight: '100vh', maxWidth: 440, margin: '0 auto' }}>
      {back && (
        <button onClick={() => { setStep(s => s - 1); setError(''); }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: '0.82rem' }}>
          <ChevronLeft size={15} /> Atrás
        </button>
      )}
      <div style={{ padding: '0 16px 40px' }}>{children}</div>
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
        ...(secondary ? { border: `2px solid ${T.coral}` } : {}),
      }}>
      {children}
    </button>
  );

  // ── STEP 0: Landing + Google Sign-In ────────────────────────────────────────
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

      {error && (
        <div style={{ background: '#FEF2F2', border: `1px solid ${T.red}`, borderRadius: 8, padding: '10px 12px', color: T.red, fontSize: '0.83rem', marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 36 }}>
        <button onClick={signInWithGoogle} disabled={signingIn}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 10, border: `1.5px solid ${T.border}`,
            background: T.card, cursor: signingIn ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontWeight: 800, fontSize: '1rem', color: T.ink,
          }}>
          {signingIn ? 'Redirigiendo...' : (
            <>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.95 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              Continuar con Google
            </>
          )}
        </button>
        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: T.muted, marginTop: 10 }}>
          Sin tarjeta de crédito · Listo en 2 minutos
        </p>
      </div>
    </Wrap>
  );

  // ── STEP 1: Store info ──────────────────────────────────────────────────────
  if (step === 1) return (
    <Wrap back>
      {session?.user?.email && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 0', marginBottom: 20 }}>
          {session.user.user_metadata?.avatar_url && (
            <img src={session.user.user_metadata.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          )}
          <span style={{ fontSize: '0.8rem', color: T.muted }}>{session.user.email}</span>
        </div>
      )}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '0.72rem', color: T.muted, marginBottom: 4 }}>Paso 1 de 2</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: T.ink, margin: 0 }}>Tu tienda</h2>
      </div>

      <Input label="Nombre de la tienda *" value={form.store_name} onChange={v => set('store_name', v)} placeholder="Tienda Don Pedro" />
      <Input label="Tu nombre" value={form.owner_name} onChange={v => set('owner_name', v)} placeholder="Pedro García" />
      <Input label="WhatsApp / Celular *" value={form.phone} onChange={v => set('phone', v)} placeholder="573001234567" hint="Con código de país, sin espacios ni +" />
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
          <input value={customDesc} onChange={e => setCustom(e.target.value)}
            placeholder="Ej: Café gratis en tu próxima visita"
            style={{ width: '100%', padding: '11px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: '0.9rem', boxSizing: 'border-box' }} />
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: `1px solid ${T.red}`, borderRadius: 8, padding: '10px 12px', color: T.red, fontSize: '0.83rem', marginBottom: 14 }}>
          {error}
        </div>
      )}

      <Btn onClick={activate} disabled={loading || (discount === 0 && !customDesc.trim())}>
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
        <p style={{ fontSize: '0.85rem', color: T.muted }}>Imprime este QR y ponlo en tu caja</p>
      </div>

      <div style={{ background: T.card, borderRadius: 14, padding: 20, textAlign: 'center', marginBottom: 16, border: `1px solid ${T.border}` }}>
        <QRCodeSVG value={result.feedback_url} size={200} level="H" style={{ display: 'block', margin: '0 auto' }} />
        <div style={{ marginTop: 12, fontSize: '0.75rem', color: T.muted, wordBreak: 'break-all' }}>
          {result.feedback_url}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button onClick={() => { navigator.clipboard.writeText(result.feedback_url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
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
