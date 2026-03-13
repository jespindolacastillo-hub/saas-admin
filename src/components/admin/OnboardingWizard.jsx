import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { tenantConfig } from '../../config/tenant';
import { useNavigate } from 'react-router-dom';
import {
  Palette, Map, QrCode, ArrowRight, ArrowLeft,
  CheckCircle2, Sparkles, Building2, Zap, Globe2
} from 'lucide-react';

// ─── Confetti Component ──────────────────────────────────────────────────────
const Confetti = () => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const pieces = Array.from({ length: 80 }).map((_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    animDelay: `${Math.random() * 2}s`,
    animDuration: `${2 + Math.random() * 2}s`,
    size: `${6 + Math.random() * 8}px`,
    rotate: `${Math.random() * 360}deg`,
  }));

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          top: '-20px',
          left: p.left,
          width: p.size,
          height: p.size,
          background: p.color,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          transform: `rotate(${p.rotate})`,
          animation: `confettiFall ${p.animDuration} ${p.animDelay} ease-in forwards`,
        }} />
      ))}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

// ─── Step Indicator ──────────────────────────────────────────────────────────
const StepIndicator = ({ current, total }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '2rem' }}>
    {Array.from({ length: total }).map((_, i) => (
      <React.Fragment key={i}>
        <div style={{
          width: i === current ? '32px' : '10px',
          height: '10px',
          borderRadius: '8px',
          background: i <= current ? 'var(--primary)' : '#e2e8f0',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
        {i < total - 1 && (
          <div style={{ width: '24px', height: '2px', background: i < current ? 'var(--primary)' : '#e2e8f0', transition: 'background 0.4s ease', borderRadius: '2px' }} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// ─── Main Wizard ─────────────────────────────────────────────────────────────
const OnboardingWizard = ({ onComplete, session }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Step 1 state
  const [orgName, setOrgName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState(null);

  // Step 2 state
  const [storeName, setStoreName] = useState('');
  const [areaName, setAreaName] = useState('');
  const [savingStructure, setSavingStructure] = useState(false);
  const [structSaved, setStructSaved] = useState(false);
  const [savedStoreId, setSavedStoreId] = useState(null);
  const [savedAreaId, setSavedAreaId] = useState(null);

  // Step 3 state
  const [qrReady, setQrReady] = useState(false);

  const STEPS = [
    { icon: <Palette size={28} />, label: t('onboarding.step1_label', 'Identidad'), color: '#3b82f6' },
    { icon: <Building2 size={28} />, label: t('onboarding.step2_label', 'Tu negocio'), color: '#10b981' },
    { icon: <QrCode size={28} />, label: t('onboarding.step3_label', 'Tu QR'), color: '#f59e0b' },
  ];

  const goNext = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setIsAnimating(false);
    }, 250);
  };
  const goBack = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setStep(s => s - 1);
      setIsAnimating(false);
    }, 250);
  };

  // ── Logo upload handler
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoUrl(URL.createObjectURL(file));
  };

  const saveStep1 = async () => {
    if (!orgName.trim()) return;
    // Save to tenants table (non-blocking)
    await supabase.from('tenants').update({ name: orgName.trim() }).eq('id', tenantConfig.id);
    goNext();
  };

  // ── Structure save handler
  const saveStep2 = async () => {
    if (!storeName.trim()) return;
    setSavingStructure(true);
    try {
      // Create store
      const { data: storeData } = await supabase.from('Tiendas_Catalogo').insert([{
        nombre: storeName.trim(),
        direccion: '',
        tenant_id: tenantConfig.id,
        activa: true
      }]).select().single();

      if (storeData) setSavedStoreId(storeData.id);

      // Create area (optional)
      if (areaName.trim() && storeData) {
        const { data: areaData } = await supabase.from('Areas_Catalogo').insert([{
          nombre: areaName.trim(),
          tenant_id: tenantConfig.id,
          orden: 1
        }]).select().single();

        if (areaData) {
          setSavedAreaId(areaData.id);
          await supabase.from('Tienda_Areas').insert([{
            tienda_id: storeData.id,
            area_id: areaData.id,
            activa: true
          }]);
        }
      }
      setStructSaved(true);
    } catch (err) {
      console.error('Error saving structure:', err);
    }
    setSavingStructure(false);
    goNext();
  };

  // ── Final completion
  const handleFinish = () => {
    setShowConfetti(true);
    localStorage.setItem('onboarding_complete', 'true');
    setTimeout(() => {
      setShowConfetti(false);
      onComplete();
    }, 3500);
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding_complete', 'true');
    onComplete();
  };

  const baseUrl = import.meta.env.VITE_FEEDBACK_URL || 'https://priceshoes.netlify.app/feedback';
  const qrUrl = savedStoreId && savedAreaId ? `${baseUrl}?t=${savedStoreId}&a=${savedAreaId}` : `${baseUrl}?t=demo&a=demo`;

  return (
    <>
      {showConfetti && <Confetti />}
      {/* Full-screen backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #f0fdf4 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '1rem',
      }}>
        {/* Header: Brand + Progress */}
        <div style={{ width: '100%', maxWidth: '520px', marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '1.5rem' }}>
            <Zap size={20} color="var(--primary)" />
            <span style={{ fontFamily: 'Outfit', fontWeight: '900', fontSize: '1.1rem', color: '#1e293b', letterSpacing: '-0.02em' }}>
              IANPS
            </span>
            <span style={{
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              color: 'white', fontSize: '0.55rem', fontWeight: '800',
              padding: '2px 7px', borderRadius: '20px', letterSpacing: '0.05em',
              textTransform: 'uppercase'
            }}>PRO</span>
          </div>

          <StepIndicator current={step} total={3} />

          {/* Step labels */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                opacity: i <= step ? 1 : 0.35, transition: 'opacity 0.3s ease',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: i <= step ? s.color : '#e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', transition: 'all 0.3s ease', fontSize: '14px',
                  boxShadow: i === step ? `0 4px 12px ${s.color}40` : 'none',
                }}>
                  {i < step ? <CheckCircle2 size={18} /> : s.icon}
                </div>
                <span style={{ fontSize: '0.6rem', fontWeight: '700', color: i === step ? '#1e293b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'white',
          borderRadius: '32px',
          padding: '2.5rem',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.04)',
          opacity: isAnimating ? 0 : 1,
          transform: isAnimating ? 'translateY(10px)' : 'translateY(0)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
        }}>
          {/* ─── STEP 0: Identity ─────────────────────────── */}
          {step === 0 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ width: '64px', height: '64px', background: '#eff6ff', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#3b82f6' }}>
                  <Palette size={32} />
                </div>
                <h2 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.5rem', letterSpacing: '-0.03em' }}>
                  {t('onboarding.s1_title', '¡Hola! ¿Cómo se llama tu negocio?')}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
                  {t('onboarding.s1_desc', 'Esto aparecerá en tus reportes y QRs. Lo puedes cambiar después.')}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('onboarding.name_label', 'Nombre de tu empresa')} *
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    placeholder={t('onboarding.name_placeholder', 'ej. Price Shoes Guadalajara')}
                    onKeyDown={e => e.key === 'Enter' && orgName.trim() && saveStep1()}
                    style={{
                      width: '100%', padding: '1rem 1.25rem', borderRadius: '14px',
                      border: '2px solid', borderColor: orgName ? 'var(--primary)' : '#e2e8f0',
                      fontSize: '1rem', fontWeight: '600', outline: 'none',
                      transition: 'border-color 0.2s ease', boxSizing: 'border-box',
                    }}
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('onboarding.logo_label', 'Tu logo')} <span style={{ fontWeight: '400', textTransform: 'none', color: '#94a3b8' }}>(opcional)</span>
                  </label>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '1rem 1.25rem', borderRadius: '14px', border: '2px dashed',
                    borderColor: logoUrl ? '#10b981' : '#e2e8f0',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    background: logoUrl ? '#f0fdf4' : '#fafafa',
                  }}>
                    {logoUrl ? (
                      <img src={logoUrl} alt="logo" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Palette size={18} color="#94a3b8" />
                      </div>
                    )}
                    <span style={{ fontSize: '0.85rem', color: logoUrl ? '#10b981' : '#94a3b8', fontWeight: '600' }}>
                      {logoUrl ? t('onboarding.logo_loaded', '✓ Logo cargado') : t('onboarding.logo_select', 'Seleccionar imagen...')}
                    </span>
                    <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 1: Structure ─────────────────────────── */}
          {step === 1 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ width: '64px', height: '64px', background: '#f0fdf4', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#10b981' }}>
                  <Building2 size={32} />
                </div>
                <h2 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.5rem', letterSpacing: '-0.03em' }}>
                  {t('onboarding.s2_title', '¿Dónde opera tu negocio?')}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
                  {t('onboarding.s2_desc', 'Agrega tu primera ubicación. Puedes agregar más después desde el menú Estructura.')}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('onboarding.store_label', 'Nombre de la tienda / sucursal')} *
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    placeholder={t('onboarding.store_placeholder', 'ej. Matrix Centro')}
                    style={{
                      width: '100%', padding: '1rem 1.25rem', borderRadius: '14px',
                      border: '2px solid', borderColor: storeName ? '#10b981' : '#e2e8f0',
                      fontSize: '1rem', fontWeight: '600', outline: 'none',
                      transition: 'border-color 0.2s ease', boxSizing: 'border-box',
                    }}
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('onboarding.area_label', 'Primera área de evaluación')} <span style={{ fontWeight: '400', textTransform: 'none', color: '#94a3b8' }}>(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={areaName}
                    onChange={e => setAreaName(e.target.value)}
                    placeholder={t('onboarding.area_placeholder', 'ej. Caja, Baños, Atención al Cliente')}
                    style={{
                      width: '100%', padding: '1rem 1.25rem', borderRadius: '14px',
                      border: '2px solid', borderColor: areaName ? '#10b981' : '#e2e8f0',
                      fontSize: '1rem', fontWeight: '500', outline: 'none',
                      transition: 'border-color 0.2s ease', boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle2 size={16} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.8rem', color: '#065f46', margin: 0, lineHeight: '1.5' }}>
                    {t('onboarding.s2_tip', 'Tip: 1 tienda + 1 área es todo lo que necesitas para generar tu primer QR de feedback.')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 2: QR ─────────────────────────── */}
          {step === 2 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', background: '#fffbeb', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#f59e0b' }}>
                <QrCode size={32} />
              </div>
              <h2 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.5rem', letterSpacing: '-0.03em' }}>
                {t('onboarding.s3_title', '¡Ya casi! Tu QR te espera.')}
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                {t('onboarding.s3_desc', 'Genera y descarga el QR de feedback para ponerlo en tu negocio. Cada vez que alguien lo escanée, recibirás una evaluación en tiempo real.')}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { icon: '📲', title: t('onboarding.how1_title', 'Cliente escanea'), desc: t('onboarding.how1_desc', 'Con su celular') },
                  { icon: '⭐', title: t('onboarding.how2_title', 'Evalúa en segundos'), desc: t('onboarding.how2_desc', 'Sin app, sin registro') },
                  { icon: '📊', title: t('onboarding.how3_title', 'Tú ves el resultado'), desc: t('onboarding.how3_desc', 'En tiempo real') },
                ].map((item, i) => (
                  <div key={i} style={{ background: '#f8fafc', borderRadius: '16px', padding: '1rem 0.75rem' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{item.icon}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1e293b', marginBottom: '2px' }}>{item.title}</div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{item.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #faf5ff 100%)', borderRadius: '20px', padding: '1.5rem', border: '1px solid #dbeafe' }}>
                <p style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('onboarding.qr_ready', 'Tu QR estará listo en el módulo "Mis QRs"')}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                  {savedStoreId ? t('onboarding.qr_store_ready', `✓ Tienda "${storeName}" creada correctamente`) : t('onboarding.qr_goto', 'Ve a "Mis QRs" en el menú lateral para generarlos.')}
                </p>
              </div>
            </div>
          )}

          {/* ─── FINAL CELEBRATION ─────────────────────────── */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
              <h2 style={{ fontFamily: 'Outfit', fontSize: '2rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.75rem', letterSpacing: '-0.03em' }}>
                {t('onboarding.done_title', '¡Estás listo para despegar!')}
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                {t('onboarding.done_desc', 'Tu plataforma de feedback inteligente está configurada. Cada QR escaneado traerá datos reales a tu dashboard.')}
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                <button
                  onClick={() => { handleFinish(); navigate('/qr'); }}
                  style={{
                    padding: '1rem', borderRadius: '16px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    color: 'white', border: 'none', cursor: 'pointer', fontSize: '1rem',
                    fontWeight: '800', fontFamily: 'Outfit', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '8px', boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)',
                  }}
                >
                  <QrCode size={20} /> {t('onboarding.go_qr', 'Generar mi primer QR ahora')}
                </button>
                <button
                  onClick={handleFinish}
                  style={{
                    padding: '0.875rem', borderRadius: '16px', background: '#f8fafc',
                    color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer',
                    fontSize: '0.9rem', fontWeight: '600',
                  }}
                >
                  {t('onboarding.go_dash', 'Ir al Dashboard primero')}
                </button>
              </div>
            </div>
          )}

          {/* ─── Navigation Buttons ─────────────────────────── */}
          {step < 3 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
              <button
                onClick={step === 0 ? handleSkip : goBack}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {step === 0 ? t('onboarding.skip', 'Saltar configuración') : (
                  <><ArrowLeft size={16} /> {t('onboarding.back', 'Atrás')}</>
                )}
              </button>

              <button
                onClick={step === 0 ? saveStep1 : step === 1 ? saveStep2 : () => { setStep(3); }}
                disabled={step === 0 ? !orgName.trim() : step === 1 ? !storeName.trim() && !savingStructure : false}
                style={{
                  padding: '0.875rem 2rem', borderRadius: '16px',
                  background: (step === 0 ? orgName.trim() : step === 1 ? storeName.trim() : true)
                    ? 'linear-gradient(135deg, var(--primary), #8b5cf6)' : '#e2e8f0',
                  color: (step === 0 ? orgName.trim() : step === 1 ? storeName.trim() : true) ? 'white' : '#94a3b8',
                  border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '800',
                  fontFamily: 'Outfit', display: 'flex', alignItems: 'center', gap: '8px',
                  transition: 'all 0.2s ease',
                  boxShadow: (step === 0 ? orgName.trim() : step === 1 ? storeName.trim() : true)
                    ? '0 4px 15px rgba(59, 130, 246, 0.25)' : 'none',
                }}
              >
                {savingStructure ? t('onboarding.saving', 'Guardando...') : (
                  step === 2 ? t('onboarding.almost', '¡Listo, ver resumen!') : t('onboarding.next', 'Continuar')
                )}
                {!savingStructure && <ArrowRight size={18} />}
              </button>
            </div>
          )}
        </div>

        {/* Footer trust signal */}
        {step < 3 && (
          <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
            <Globe2 size={13} />
            <span style={{ fontSize: '0.72rem', fontWeight: '600' }}>
              {t('onboarding.footer', 'Funciona en ES · EN · PT • 100% seguro')}
            </span>
          </div>
        )}
      </div>
    </>
  );
};

export default OnboardingWizard;
