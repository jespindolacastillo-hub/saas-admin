import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus, Mail, Lock, ShieldCheck, AlertCircle, Eye, EyeOff, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const font = "'Plus Jakarta Sans', system-ui, sans-serif";

// ─── Animated Orb ─────────────────────────────────────────────────────────────
const BgOrbs = () => (
  <>
    <style>{`
      @keyframes float1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-20px) scale(1.05)} }
      @keyframes float2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-20px,30px) scale(0.95)} }
      @keyframes float3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(15px,15px)} }
    `}</style>
    <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,92,58,0.3) 0%, transparent 70%)', top: '-150px', left: '-100px', animation: 'float1 8s ease-in-out infinite', filter: 'blur(1px)' }} />
    <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,201,167,0.25) 0%, transparent 70%)', bottom: '-100px', right: '-80px', animation: 'float2 10s ease-in-out infinite' }} />
    <div style={{ position: 'absolute', width: '250px', height: '250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)', top: '40%', left: '60%', animation: 'float3 6s ease-in-out infinite' }} />
  </>
);

// ─── Password strength ────────────────────────────────────────────────────────
const strengthOf = (pw) => {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return s;
};
const strengthColors = ['#e2e8f0', '#ef4444', '#f59e0b', '#10b981', '#00C9A7'];
const strengthLabels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];

// ─── Main Auth ────────────────────────────────────────────────────────────────
const Auth = ({ onLogin }) => {
  const { t } = useTranslation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [forceChange, setForceChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [focused, setFocused] = useState(null);

  const pwStrength = strengthOf(password);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null); setMessage(null);
    try {
      if (isSignUp) {
        if (password.length < 8) throw new Error(t('auth.alerts.password_too_short'));
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { nombre } },
        });
        if (error) throw error;
        setMessage(t('auth.alerts.signup_success'));
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        const { data: userData } = await supabase.from('Usuarios').select('debe_cambiar_password').eq('email', email).single();
        if (userData?.debe_cambiar_password) { setForceChange(true); return; }
        if (onLogin) onLogin();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForceChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError(t('auth.alerts.password_mismatch')); return; }
    if (newPassword.length < 8) { setError(t('auth.alerts.password_too_short')); return; }
    setLoading(true); setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      await supabase.from('Usuarios').update({ debe_cambiar_password: false }).eq('email', email);
      setMessage(t('auth.alerts.password_updated'));
      setTimeout(() => { if (onLogin) onLogin(); }, 1500);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const inputStyle = (name) => ({
    width: '100%', padding: '0.9rem 0.9rem 0.9rem 2.8rem',
    borderRadius: '14px', fontSize: '0.95rem', outline: 'none',
    transition: 'all 0.2s', boxSizing: 'border-box', fontFamily: font,
    border: `2px solid ${focused === name ? '#FF5C3A' : '#e2e8f0'}`,
    background: focused === name ? '#FFF1EE' : '#fafafa',
  });

  if (forceChange) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0D0D12, #1a1a2e)', padding: '2rem', fontFamily: font }}>
        <div style={{ maxWidth: '420px', width: '100%', background: 'white', borderRadius: '28px', boxShadow: '0 50px 100px rgba(0,0,0,0.4)', padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <ShieldCheck size={48} color="#FF5C3A" style={{ marginBottom: '1rem' }} />
            <h1 style={{ fontFamily: font, fontSize: '1.6rem', fontWeight: '900', color: '#0D0D12' }}>{t('auth.force_change_title')}</h1>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '0.4rem' }}>{t('auth.force_change_desc')}</p>
          </div>
          <form onSubmit={handleForceChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t('auth.new_password_label')} style={{ ...inputStyle('np'), paddingLeft: '1rem' }} />
            <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t('auth.confirm_password_label')} style={{ ...inputStyle('cp'), paddingLeft: '1rem' }} />
            {error && <div style={{ color: '#dc2626', fontSize: '0.8rem', textAlign: 'center' }}>{error}</div>}
            {message && <div style={{ color: '#10b981', fontSize: '0.8rem', textAlign: 'center' }}>{message}</div>}
            <button type="submit" disabled={loading} style={{ padding: '1rem', background: '#FF5C3A', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', fontFamily: font }}>
              {loading ? '...' : t('auth.update_btn')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', fontFamily: font,
    }}>
      {/* ── Left panel: brand ── */}
      <div style={{
        flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        background: 'linear-gradient(145deg, #0D0D12 0%, #1a0f0a 50%, #0D0D12 100%)',
        padding: '2.5rem', position: 'relative', overflow: 'hidden',
        minWidth: 0,
      }}
        className="auth-left-panel"
      >
        <BgOrbs />
        <style>{`
          @media (max-width: 768px) { .auth-left-panel { display: none !important; } }
        `}</style>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', width: '32px', height: '32px', flexShrink: 0 }}>
            <div style={{ borderRadius: '4px', background: '#FF5C3A' }} />
            <div style={{ borderRadius: '4px', background: '#00C9A7' }} />
            <div style={{ borderRadius: '4px', background: '#7C3AED' }} />
            <div style={{ borderRadius: '4px', background: 'rgba(255,255,255,0.3)' }} />
          </div>
          <span style={{ fontFamily: font, fontWeight: 800, fontSize: '1.3rem', color: 'white', letterSpacing: '-0.02em' }}>retelio</span>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,92,58,0.15)', border: '1px solid rgba(255,92,58,0.3)', borderRadius: '100px', padding: '6px 14px', marginBottom: '2rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00C9A7', display: 'inline-block' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#FF8C75', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Motor de reputación para negocios
            </span>
          </div>
          <h2 style={{ fontFamily: font, fontSize: '2.8rem', fontWeight: '900', color: 'white', lineHeight: '1.1', letterSpacing: '-0.04em', marginBottom: '1.5rem' }}>
            Convierte cada visita en una reseña de 5 estrellas.
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { emoji: '⭐', text: 'QR inteligente que filtra feedback positivo a Google' },
              { emoji: '📲', text: 'Alertas WhatsApp cuando un cliente está inconforme' },
              { emoji: '📊', text: 'Dashboard de reputación en tiempo real' },
            ].map(f => (
              <div key={f.emoji} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>{f.emoji}</div>
                <span style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', fontWeight: '500' }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>
          © 2026 Retelio · Inteligencia que escucha.
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div style={{
        width: '480px', flexShrink: 0, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '3rem 3rem',
        background: 'white', overflowY: 'auto',
      }}
        className="auth-right-panel"
      >
        <style>{`
          @media (max-width: 768px) {
            .auth-right-panel { width: 100% !important; padding: 2rem 1.5rem !important; }
          }
        `}</style>

        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontFamily: font, fontSize: '2rem', fontWeight: '900', color: '#0D0D12', letterSpacing: '-0.03em', margin: '0 0 0.4rem' }}>
            {isSignUp ? 'Crear cuenta' : 'Bienvenido de vuelta'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            {isSignUp ? 'Comienza gratis. Sin tarjeta de crédito.' : 'Ingresa a tu dashboard de reputación.'}
          </p>
        </div>

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {isSignUp && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#374151', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('auth.name_label', 'Tu nombre')}</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: focused === 'nombre' ? '#FF5C3A' : '#cbd5e1', transition: 'color 0.2s' }} />
                <input autoFocus type="text" required value={nombre} onChange={e => setNombre(e.target.value)}
                  onFocus={() => setFocused('nombre')} onBlur={() => setFocused(null)}
                  placeholder={t('auth.name_placeholder', 'ej. María Rodríguez')}
                  style={inputStyle('nombre')} />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#374151', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('auth.email_label', 'Correo electrónico')}</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: focused === 'email' ? '#FF5C3A' : '#cbd5e1', transition: 'color 0.2s' }} />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                placeholder="tu@empresa.com"
                style={inputStyle('email')} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#374151', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('auth.password_label', 'Contraseña')}</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: focused === 'pw' ? '#FF5C3A' : '#cbd5e1', transition: 'color 0.2s' }} />
              <input type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('pw')} onBlur={() => setFocused(null)}
                placeholder={isSignUp ? t('auth.password_placeholder_min', 'Mínimo 8 caracteres') : '••••••••'}
                style={{ ...inputStyle('pw'), paddingRight: '2.8rem' }} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {isSignUp && password && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ flex: 1, height: '4px', borderRadius: '4px', background: i <= pwStrength ? strengthColors[pwStrength] : '#e2e8f0', transition: 'background 0.3s' }} />
                  ))}
                </div>
                <span style={{ fontSize: '0.7rem', color: strengthColors[pwStrength] || '#94a3b8', fontWeight: '700' }}>{strengthLabels[pwStrength]}</span>
              </div>
            )}
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1rem', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.82rem', fontWeight: '600' }}>
              <AlertCircle size={16} />{error}
            </div>
          )}
          {message && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem 1rem', borderRadius: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: '0.82rem', fontWeight: '600' }}>
              <ShieldCheck size={16} />{message}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            padding: '1rem', borderRadius: '14px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? '#e2e8f0' : '#FF5C3A',
            color: loading ? '#94a3b8' : 'white', fontSize: '1rem', fontWeight: '800', fontFamily: font,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: loading ? 'none' : '0 8px 24px rgba(255,92,58,0.3)',
            transition: 'all 0.2s', marginTop: '0.25rem',
          }}>
            {loading ? '⟳ Procesando...' : isSignUp ? <><UserPlus size={20} /> Crear cuenta gratis</> : <><LogIn size={20} /> Entrar</>}
          </button>
        </form>

        <div style={{ marginTop: '1.75rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', fontFamily: font }}>
            {isSignUp ? '¿Ya tienes cuenta?' : '¿Primera vez aquí?'}
            {' '}
            <button onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
              style={{ background: 'none', border: 'none', color: '#FF5C3A', fontWeight: '800', cursor: 'pointer', fontSize: '0.85rem', fontFamily: font }}>
              {isSignUp ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </p>
        </div>

        {isSignUp && (
          <p style={{ marginTop: '1.25rem', fontSize: '0.72rem', color: '#cbd5e1', textAlign: 'center', lineHeight: '1.5', fontFamily: font }}>
            Al registrarte aceptas nuestros Términos de Servicio y Política de Privacidad.
          </p>
        )}
      </div>
    </div>
  );
};

export default Auth;
