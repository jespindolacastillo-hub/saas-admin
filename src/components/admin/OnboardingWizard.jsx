import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { tenantConfig, getTenantId } from '../../config/tenant';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import {
  Palette, QrCode, ArrowRight, ArrowLeft, CheckCircle2,
  Building2, MessageSquare, X, ChevronRight, Globe2, Zap
} from 'lucide-react';

// ─── Language Switcher ────────────────────────────────────────────────────────
const LANGS = [
  { code: 'es', flag: '🇲🇽', label: 'ES' },
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'pt', flag: '🇧🇷', label: 'PT' },
];

// ─── Confetti ─────────────────────────────────────────────────────────────────
const Confetti = () => {
  const colors = ['#FF5C3A', '#00C9A7', '#7C3AED', '#F59E0B', '#0D0D12', '#EC4899'];
  const pieces = Array.from({ length: 90 }).map((_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1.5}s`,
    duration: `${2.5 + Math.random() * 2}s`,
    size: `${5 + Math.random() * 9}px`,
    shape: i % 3 === 0 ? '0%' : i % 3 === 1 ? '50%' : '2px',
  }));
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 99999, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: '-20px', left: p.left,
          width: p.size, height: p.size, background: p.color, borderRadius: p.shape,
          animation: `fall ${p.duration} ${p.delay} ease-in forwards`,
        }} />
      ))}
      <style>{`@keyframes fall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(110vh) rotate(540deg);opacity:0} }`}</style>
    </div>
  );
};

// ─── Step Definitions ──────────────────────────────────────────────────────────
const useSteps = (t) => [
  {
    id: 'identity',
    icon: '🏢',
    color: '#FF5C3A',
    gradient: 'linear-gradient(145deg, #0D0D12 0%, #2d1208 50%, #0D0D12 100%)',
    headline: '¡Hola! ¿Cómo se llama tu negocio?',
    desc: 'Aparecerá en tus reportes y QRs. Puedes cambiarlo después.',
    preview: '🏢',
  },
  {
    id: 'structure',
    icon: '📍',
    color: '#00C9A7',
    gradient: 'linear-gradient(145deg, #0D0D12 0%, #021f1a 50%, #0D0D12 100%)',
    headline: '¿Dónde opera tu negocio?',
    desc: 'Crea tu primera sucursal y área de evaluación.',
    preview: '📍',
  },
  {
    id: 'question',
    icon: '💬',
    color: '#7C3AED',
    gradient: 'linear-gradient(145deg, #0D0D12 0%, #1a0a2e 50%, #0D0D12 100%)',
    headline: '¿Qué le preguntas a tus clientes?',
    desc: 'Esta pregunta aparecerá en el formulario de feedback.',
    preview: '💬',
  },
  {
    id: 'done',
    icon: '🚀',
    color: '#FF5C3A',
    gradient: 'linear-gradient(145deg, #0D0D12 0%, #2d1208 50%, #0D0D12 100%)',
    headline: '¡Todo listo para despegar!',
    desc: 'Tu motor de reputación está configurado.',
    preview: '🚀',
  },
];

// ─── Progress line ────────────────────────────────────────────────────────────
const ProgressBar = ({ current, total }) => (
  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
    {Array.from({ length: total - 1 }).map((_, i) => (
      <React.Fragment key={i}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${i <= current ? 'white' : 'rgba(255,255,255,0.25)'}`,
          background: i < current ? 'white' : i === current ? 'rgba(255,255,255,0.15)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.4s',
        }}>
          {i < current
            ? <CheckCircle2 size={14} color="#1e293b" />
            : <span style={{ fontSize: '0.7rem', fontWeight: '800', color: i === current ? 'white' : 'rgba(255,255,255,0.4)' }}>{i + 1}</span>
          }
        </div>
        <div style={{ flex: 1, height: '2px', background: i < current ? 'white' : 'rgba(255,255,255,0.2)', borderRadius: '2px', transition: 'background 0.4s' }} />
      </React.Fragment>
    ))}
    {/* Last step circle */}
    <div style={{
      width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
      border: `2px solid ${total - 1 <= current ? 'white' : 'rgba(255,255,255,0.25)'}`,
      background: total - 1 < current ? 'white' : total - 1 === current ? 'rgba(255,255,255,0.15)' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: '0.7rem', fontWeight: '800', color: total - 1 === current ? 'white' : 'rgba(255,255,255,0.4)' }}>{total}</span>
    </div>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────
const TOTAL_STEPS = 4;

const OnboardingWizard = ({ onComplete, session, initialStep = 0, stores = [], areas = [], refreshData = () => {} }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const STEPS = useSteps(t);

  const [step, setStep] = useState(initialStep);
  const [dir, setDir] = useState(1);  // 1=forward, -1=back
  const [visible, setVisible] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  // Form data
  const [orgName, setOrgName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [areaName, setAreaName] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [tipoRespuesta, setTipoRespuesta] = useState('stars');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Saved IDs
  const [savedTenantId, setSavedTenantId] = useState(null);
  const [savedStoreId, setSavedStoreId] = useState(null);
  const [savedAreaId, setSavedAreaId] = useState(null);



  // Effect to restore IDs if starting mid-flow
  useEffect(() => {
    if (initialStep > 1 && stores.length > 0) {
      // Pick the first store as default if none specified (checklist launch)
      setSavedStoreId(stores[0]?.id || null);
      setStoreName(stores[0]?.nombre || '');
    }
    if (initialStep > 2 && areas.length > 0) {
      setSavedAreaId(areas[0]?.id || null);
      setAreaName(areas[0]?.nombre || '');
    }
  }, [initialStep, stores, areas]);

  const currentStep = STEPS[step];

  const transition = (newStep, direction = 1) => {
    setDir(direction);
    setVisible(false);
    setTimeout(() => {
      setStep(newStep);
      setError('');
      setVisible(true);
    }, 250);
  };

  const goBack = () => step > 0 && transition(step - 1, -1);


  const saveStep0 = async () => {
    if (!orgName.trim()) return;
    try {
      const tid = getTenantId();
      if (tid && tid !== '00000000-0000-0000-0000-000000000000') await supabase.from('tenants').update({ name: orgName.trim() }).eq('id', tid);
    } catch (_) {}
    transition(1);
  };

  const saveStep1 = async () => {
    if (!storeName.trim()) return;
    try {
      const tid = getTenantId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      let validTid = tid;
      if (!tid || !uuidRegex.test(tid) || tid === '00000000-0000-0000-0000-000000000000') {
        // 0. Auto-create tenant for fresh user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Debes iniciar sesión primero.');
        
        const { data: newTenant, error: tenantErr } = await supabase
          .from('tenants')
          .insert([{ name: storeName.trim() }])
          .select('id').single();
        
        if (tenantErr) throw tenantErr;
        validTid = newTenant?.id;
        
        // Save tenant ID so the QR step can use it before App.jsx refreshes
        setSavedTenantId(validTid);

        // 1. Link user to new tenant (UPSERT ensures row creation if missing)
        const { error: userUpdateErr } = await supabase
          .from('Usuarios')
          .upsert({ 
            id: user.id,
            email: user.email,
            tenant_id: validTid,
            nombre: user.user_metadata?.nombre || '',
            rol: 'admin',
            activo: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'email' });
        
        if (userUpdateErr) throw userUpdateErr;
      }

      // 1. Create or Get Store (STRICT UUID)
      let storeIdToUse;
      const { data: existingStore } = await supabase
        .from('Tiendas_Catalogo')
        .select('id')
        .eq('nombre', storeName.trim())
        .eq('tenant_id', validTid)
        .maybeSingle();

      if (existingStore && uuidRegex.test(existingStore.id)) {
        storeIdToUse = existingStore.id;
      } else {
        const { data: newStore, error: newStoreErr } = await supabase
          .from('Tiendas_Catalogo')
          .insert([{ nombre: storeName.trim(), tenant_id: validTid }])
          .select('id').single();
        if (newStoreErr) throw newStoreErr;
        storeIdToUse = newStore?.id;
      }
      setSavedStoreId(storeIdToUse);

      // 2. Create Area (Simplified Model - NO JUNCTION)
      if (areaName.trim()) {
        const { data: newArea, error: newAreaErr } = await supabase
          .from('Areas_Catalogo')
          .insert([{ 
            nombre: areaName.trim(), 
            tenant_id: validTid,
            tienda_id: storeIdToUse 
          }])
          .select('id').single();
        
        if (newAreaErr) throw newAreaErr;
        setSavedAreaId(newArea?.id);
        // removed setAreaName as it was causing it to be undefined
      }

      await refreshData();
      transition(2);
    } catch (err) {
      console.error('Wizard Error:', err);
      setError(err.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const saveStep2 = async () => {
    if (!questionText.trim()) return;
    setSaving(true); setError('');
    try {
      const tid = getTenantId();
      let validTid = tid;
      if (!tid || tid === '00000000-0000-0000-0000-000000000000') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase.from('Usuarios').select('tenant_id').eq('email', user.email).maybeSingle();
          if (userData?.tenant_id) validTid = userData.tenant_id;
        }
      }

      // Use existing IDs if mid-flow
      const finalAreaId = savedAreaId || (areas.length > 0 ? areas[0]?.id : null);

      if (finalAreaId && validTid && validTid !== '00000000-0000-0000-0000-000000000000') {
        const { error: qErr } = await supabase.from('Area_Preguntas').insert([{
          area_id: finalAreaId, tenant_id: validTid,
          numero_pregunta: 1, texto_pregunta: questionText.trim(),
          tipo_respuesta: tipoRespuesta, activa: true,
        }]);
        if (qErr) throw qErr;
      }
      await refreshData();
      transition(3);
    } catch (err) {
      setError(err.message || 'Error al guardar pregunta.');
    }
    setSaving(false);
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding_complete', 'true');
    onComplete();
  };

  const handleFinish = (goTo) => {
    setShowConfetti(true);
    localStorage.setItem('onboarding_complete', 'true');
    setTimeout(() => {
      setShowConfetti(false);
      onComplete();
      if (goTo) navigate(goTo);
    }, 3000);
  };

  const handleNext = () => {
    if (step === 0) saveStep0();
    else if (step === 1) saveStep1();
    else if (step === 2) saveStep2();
  };

  const canProceed = step === 0 ? !!orgName.trim() : step === 1 ? !!storeName.trim() : step === 2 ? !!questionText.trim() : true;

  const baseUrl = window.location.origin + '/feedback';
  const tid = savedTenantId || getTenantId() || '00000000-0000-0000-0000-000000000000';
  console.log('Wizard - Base URL used for QR:', baseUrl);
  const qrUrl = savedStoreId ? `${baseUrl}?tid=${tid}&t=${savedStoreId}${savedAreaId ? `&a=${savedAreaId}` : ''}` : baseUrl;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {showConfetti && <Confetti />}

      {/* ══════════════════════════════════════════════════════════════════
          LEFT PANEL — brand + step preview (always visible, changes color)
         ══════════════════════════════════════════════════════════════════ */}
      <div style={{
        width: '42%', flexShrink: 0,
        background: currentStep.gradient,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '2.5rem', position: 'relative', overflow: 'hidden',
        transition: 'background 0.5s ease',
      }}
        className="wizard-left"
      >
        <style>{`
          @media (max-width:768px){ .wizard-left{display:none!important} .wizard-right{width:100%!important} }
          @keyframes panelEntry {from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)}}
        `}</style>

        {/* Decorative blobs */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', width: '350px', height: '350px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', top: '-100px', left: '-80px' }} />
          <div style={{ position: 'absolute', width: '250px', height: '250px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', bottom: '-50px', right: '-60px' }} />
          <div style={{ position: 'absolute', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', top: '40%', left: '60%' }} />
        </div>

        {/* Top: logo + language */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', width: '26px', height: '26px' }}>
              <div style={{ borderRadius: '3px', background: '#FF5C3A' }} />
              <div style={{ borderRadius: '3px', background: '#00C9A7' }} />
              <div style={{ borderRadius: '3px', background: '#7C3AED' }} />
              <div style={{ borderRadius: '3px', background: 'rgba(255,255,255,0.3)' }} />
            </div>
            <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui", fontWeight: 800, fontSize: '1.1rem', color: 'white', letterSpacing: '-0.02em' }}>retelio</span>
          </div>
        </div>

        {/* Center: big emoji + text */}
        <div style={{ position: 'relative', zIndex: 1, animation: 'panelEntry 0.4s ease' }} key={step}>
          <div style={{ fontSize: '5rem', lineHeight: '1', marginBottom: '1.5rem' }}>{currentStep.preview}</div>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '100px', padding: '5px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t('onboarding.step', 'Paso')} {step + 1} / {TOTAL_STEPS}
            </span>
          </div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', system-ui", fontSize: '2rem', fontWeight: '900', color: 'white', lineHeight: '1.15', letterSpacing: '-0.03em', marginBottom: '1rem' }}>
            {currentStep.headline}
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.65)', lineHeight: '1.6', maxWidth: '320px' }}>
            {currentStep.desc}
          </p>
        </div>

        {/* Bottom: progress */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <ProgressBar current={step} total={TOTAL_STEPS} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          RIGHT PANEL — the actual form / content
         ══════════════════════════════════════════════════════════════════ */}
      <div
        className="wizard-right"
        style={{
          flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Top bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.25rem 2.5rem', background: 'white',
          borderBottom: '1px solid #f1f5f9', flexShrink: 0,
        }}>
          {step > 0 && step < 3
            ? <button onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', padding: 0 }}>
                <ArrowLeft size={16} /> {t('onboarding.back', 'Atrás')}
              </button>
            : <div />
          }
          {/* Mobile language switcher */}
          <div style={{ display: 'flex', gap: '4px' }} className="wizard-mobile-lang">
            <style>{`@media (min-width:769px){.wizard-mobile-lang{display:none!important}}`}</style>
            {LANGS.map(l => (
              <button key={l.code} onClick={() => i18n.changeLanguage(l.code)}
                style={{ padding: '4px 9px', borderRadius: '20px', border: `1.5px solid ${i18n.language === l.code ? '#FF5C3A' : '#e2e8f0'}`, background: i18n.language === l.code ? '#FFF1EE' : 'white', color: i18n.language === l.code ? '#FF5C3A' : '#94a3b8', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer' }}>
                {l.flag} {l.label}
              </button>
            ))}
          </div>
          {step < 3 && (
            <button onClick={handleSkip} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700', padding: '6px 12px', borderRadius: '8px', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <X size={14} /> {t('onboarding.skip', 'Saltar configuración')}
            </button>
          )}
        </div>

        {/* Content area */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '3rem 2.5rem',
        }}>
          <div style={{
            width: '100%', maxWidth: '480px',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : `translateY(${dir * 16}px)`,
            transition: 'opacity 0.25s ease, transform 0.25s ease',
          }}>

            {/* ── Step 0: Identity ── */}
            {step === 0 && (
              <div>
                <div style={{ marginBottom: '2rem' }}>
                  <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui", fontSize: '2rem', fontWeight: '900', color: '#0D0D12', margin: '0 0 0.5rem', letterSpacing: '-0.03em' }}>
                    {t('onboarding.s1_title', '¿Cómo se llama tu negocio?')}
                  </h1>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{t('onboarding.s1_desc', 'Puedes cambiarlo después desde Ajustes.')}</p>
                </div>
                <label style={LS}>{t('onboarding.name_label', 'Nombre de la empresa')} *</label>
                <input autoFocus type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && orgName.trim() && saveStep0()}
                  placeholder={t('onboarding.name_placeholder', 'ej. Price Shoes Guadalajara')}
                  style={IS(!!orgName)} />

                <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  {[
                    { emoji: '📊', title: t('onboarding.feat1_t', 'Dashboard NPS'), sub: t('onboarding.feat1_d', 'En tiempo real') },
                    { emoji: '📲', title: t('onboarding.feat2_t', 'QR Feedback'), sub: t('onboarding.feat2_d', 'Sin apps') },
                    { emoji: '🌐', title: t('onboarding.feat3_t', 'Multiidioma'), sub: t('onboarding.feat3_d', 'ES · EN · PT') },
                  ].map(f => (
                    <div key={f.emoji} style={{ background: 'white', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{f.emoji}</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1e293b' }}>{f.title}</div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{f.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 1: Store + Area ── */}
            {step === 1 && (
              <div>
                <div style={{ marginBottom: '2rem' }}>
                  <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui", fontSize: '2rem', fontWeight: '900', color: '#0D0D12', margin: '0 0 0.5rem', letterSpacing: '-0.03em' }}>
                    {t('onboarding.s2_title', '¿Dónde opera tu negocio?')}
                  </h1>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{t('onboarding.s2_desc', 'Agrega tu primer punto de venta y área.')}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={LS}>{t('onboarding.store_label', 'Nombre de la tienda')} *</label>
                    <input autoFocus type="text" value={storeName} onChange={e => setStoreName(e.target.value)}
                      placeholder={t('onboarding.store_placeholder', 'ej. Sucursal Centro')}
                      style={IS(!!storeName)} />
                  </div>
                  <div>
                    <label style={LS}>{t('onboarding.area_label', 'Área de evaluación')} <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'none' }}>(opcional)</span></label>
                    <input type="text" value={areaName} onChange={e => setAreaName(e.target.value)}
                      placeholder={t('onboarding.area_placeholder', 'ej. Cajas, Baños, Atención al Cliente')}
                      style={IS(!!areaName)} />
                  </div>
                </div>
                <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '0.85rem 1rem', marginTop: '1.25rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span>💡</span>
                  <p style={{ fontSize: '0.78rem', color: '#065f46', margin: 0 }}>{t('onboarding.s2_tip', '1 tienda + 1 área es suficiente para generar tu primer QR.')}</p>
                </div>
                {error && (
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ padding: '1.25rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center', color: '#dc2626' }}>
                <Zap size={20} />
                <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{error}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                <button 
                  onClick={() => {
                    localStorage.removeItem('saas_tenant_config');
                    window.location.reload();
                  }}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: '#FF5C3A', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer' }}
                >
                  Limpiar sesión y reintentar
                </button>
                <button 
                  onClick={async () => {
                    localStorage.clear();
                    await supabase.auth.signOut();
                    window.location.reload();
                  }}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'white', color: '#dc2626', border: '2px solid #dc2626', fontWeight: '700', cursor: 'pointer' }}
                >
                  Borrón y Cuenta Nueva (Limpieza Total)
                </button>
              </div>
            </div>
          )}
              </div>
            )}

            {/* ── Step 2: Question ── */}
            {step === 2 && (
              <div>
                <div style={{ marginBottom: '2rem' }}>
                  <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui", fontSize: '2rem', fontWeight: '900', color: '#0D0D12', margin: '0 0 0.5rem', letterSpacing: '-0.03em' }}>
                    {t('onboarding.s3_title', '¿Qué le preguntas a tus clientes?')}
                  </h1>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>{t('onboarding.s3_desc', 'Puedes agregar más preguntas después.')}</p>
                </div>

                {/* Type picker */}
                <label style={LS}>{t('onboarding.type_label', 'Tipo de respuesta')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {[
                    { v: 'stars', e: '⭐', t: 'Estrellas (1-5)', s: 'Opinión escalada' },
                    { v: 'si_no', e: '👍', t: 'Sí / No', s: 'Respuesta binaria' },
                    { v: 'nps', e: '📊', t: 'NPS (0-10)', s: 'Probabilidad de rec.' },
                    { v: 'emoji', e: '😊', t: 'Emojis', s: 'Visualmente intuitivo' },
                  ].map(opt => (
                    <button key={opt.v} type="button" onClick={() => setTipoRespuesta(opt.v)}
                      style={{ padding: '0.9rem 1rem', borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                        border: `2px solid ${tipoRespuesta === opt.v ? '#8b5cf6' : '#e2e8f0'}`,
                        background: tipoRespuesta === opt.v ? '#faf5ff' : 'white', transition: 'all 0.2s' }}>
                      <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{opt.e}</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: '800', color: tipoRespuesta === opt.v ? '#7c3aed' : '#1e293b' }}>{opt.t}</div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>{opt.s}</div>
                    </button>
                  ))}
                </div>

                {/* Suggestion chips */}
                <label style={LS}>{t('onboarding.question_label', 'Tu pregunta')} *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.75rem' }}>
                  {[
                    t('onboarding.q1', '¿Cómo calificarías tu experiencia hoy?'),
                    t('onboarding.q2', '¿El servicio cumplió tus expectativas?'),
                    t('onboarding.q3', '¿Nos recomendarías a un amigo?'),
                  ].map(s => (
                    <button key={s} type="button" onClick={() => setQuestionText(s)}
                      style={{ padding: '5px 10px', borderRadius: '20px',
                        border: `1.5px solid ${questionText === s ? '#8b5cf6' : '#e2e8f0'}`,
                        background: questionText === s ? '#faf5ff' : 'white',
                        color: questionText === s ? '#7c3aed' : '#64748b',
                        fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
                      {s}
                    </button>
                  ))}
                </div>
                <input autoFocus type="text" value={questionText} onChange={e => setQuestionText(e.target.value)}
                  placeholder={t('onboarding.question_placeholder', 'ej. ¿Cómo calificarías tu visita hoy?')}
                  style={IS(!!questionText)} />
                {!savedAreaId && (
                  <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '0.75rem 1rem', marginTop: '1rem', display: 'flex', gap: '10px' }}>
                    <span>⚠️</span>
                    <p style={{ fontSize: '0.75rem', color: '#92400e', margin: 0 }}>
                      {t('onboarding.s3_no_area', 'No creaste un área. La pregunta se guardará sin asignar — puedes moverla después.')}
                    </p>
                  </div>
                )}
                {error && <ErrBox msg={error} />}
              </div>
            )}

            {/* ── Step 3: Done ── */}
            {step === 3 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🎉</div>
                <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui", fontSize: '2.25rem', fontWeight: '900', color: '#0D0D12', letterSpacing: '-0.04em', margin: '0 0 0.75rem' }}>
                  {t('onboarding.done_title', '¡Todo listo para empezar!')}
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.65', maxWidth: '380px', margin: '0 auto 2rem' }}>
                  {t('onboarding.done_desc', 'Tu configuración ha sido guardada con éxito. El código QR de la derecha ya está activo y puedes empezar a recibir feedback ahora mismo.')}
                </p>

                {/* Summary & QR Preview */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr ppx', gap: '20px', marginBottom: '2rem' }}>
                  <div style={{ background: 'white', borderRadius: '18px', padding: '1.25rem', border: '1px solid #f1f5f9', textAlign: 'left' }}>
                    {[
                      { icon: '🏢', label: t('onboarding.sum_store', 'Tienda'), val: storeName || '—' },
                      { icon: '🗂️', label: t('onboarding.sum_area', 'Área'), val: areaName || '—' },
                      { icon: '❓', label: t('onboarding.sum_question', 'Pregunta'), val: questionText || '—' },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f8fafc', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '1rem' }}>{r.icon}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', minWidth: '60px', textTransform: 'uppercase', paddingTop: '2px' }}>{r.label}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1e293b' }}>{r.val}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'white', borderRadius: '18px', padding: '1.25rem', border: '2px solid rgba(255,92,58,0.15)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <div style={{ padding: '12px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                      <QRCodeSVG 
                        id="onboarding-qr"
                        value={qrUrl}
                        size={140}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    <button 
                      onClick={() => alert(t('qr.print_not_available_yet', 'La impresión estará disponible desde el dashboard principal.'))}
                      style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '0.72rem', fontWeight: '800', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      🖨️ {t('onboarding.print_qr', 'Imprimir QR')}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button onClick={() => handleFinish('/qr')}
                    style={{ padding: '1rem 2rem', borderRadius: '16px', background: '#FF5C3A', color: 'white', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: '800', fontFamily: "'Plus Jakarta Sans', system-ui", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(255,92,58,0.3)' }}>
                    <QrCode size={20} /> {t('onboarding.go_qr', 'Ver mis Códigos QR')}
                  </button>
                  <button onClick={() => handleFinish(null)}
                    style={{ padding: '0.9rem', borderRadius: '16px', background: 'white', color: '#64748b', border: '1.5px solid #e2e8f0', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '700' }}>
                    {t('onboarding.go_dash', 'Ir al Dashboard de métricas')}
                  </button>
                </div>
              </div>
            )}

            {/* ── Navigation (steps 0-2) ── */}
            {step < 3 && (
              <button
                disabled={saving || !canProceed}
                onClick={handleNext}
                style={{
                  marginTop: '2rem', width: '100%', padding: '1rem 2rem',
                  borderRadius: '16px', border: 'none', cursor: saving || !canProceed ? 'not-allowed' : 'pointer',
                  background: saving || !canProceed ? '#e2e8f0' : '#FF5C3A',
                  color: saving || !canProceed ? '#94a3b8' : 'white',
                  fontSize: '1rem', fontWeight: '800', fontFamily: "'Plus Jakarta Sans', system-ui",
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: saving || !canProceed ? 'none' : '0 8px 24px rgba(59,130,246,0.25)',
                  transition: 'all 0.2s',
                }}>
                {saving ? t('onboarding.saving', 'Guardando...') : t('onboarding.next', 'Continuar')}
                {!saving && <ArrowRight size={18} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Shared micro-styles ──────────────────────────────────────────────────────
const LS = {
  fontSize: '0.72rem', fontWeight: '800', color: '#374151',
  marginBottom: '6px', display: 'block',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};
const IS = (active) => ({
  width: '100%', padding: '0.9rem 1.1rem', borderRadius: '14px',
  border: `2px solid ${active ? '#FF5C3A' : '#e2e8f0'}`,
  fontSize: '0.95rem', fontWeight: '600', outline: 'none',
  transition: 'border-color 0.2s', boxSizing: 'border-box',
  background: active ? '#f0f7ff' : '#fafafa',
});
const ErrBox = ({ msg }) => (
  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '0.75rem 1rem', marginTop: '1rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
    <span>⚠️</span>
    <p style={{ fontSize: '0.78rem', color: '#dc2626', margin: 0, fontWeight: '600' }}>{msg}</p>
  </div>
);

export default OnboardingWizard;
