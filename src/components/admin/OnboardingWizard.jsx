import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
  Palette, QrCode, ArrowRight, ArrowLeft,
  CheckCircle2, Building2, Zap, Globe2, MessageSquare
} from 'lucide-react';

// ─── Confetti ────────────────────────────────────────────────────────────────
const Confetti = () => {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const pieces = Array.from({ length: 80 }).map((_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    animDelay: `${Math.random() * 2}s`,
    animDuration: `${2 + Math.random() * 2}s`,
    size: `${6 + Math.random() * 8}px`,
  }));
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: '-20px', left: p.left,
          width: p.size, height: p.size, background: p.color, borderRadius: '50%',
          animation: `confettiFall ${p.animDuration} ${p.animDelay} ease-in forwards`,
        }} />
      ))}
      <style>{`@keyframes confettiFall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }`}</style>
    </div>
  );
};

// ─── Step Dots ───────────────────────────────────────────────────────────────
const StepDots = ({ current, total }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '1.5rem' }}>
    {Array.from({ length: total }).map((_, i) => (
      <React.Fragment key={i}>
        <div style={{
          width: i === current ? '28px' : '10px', height: '10px', borderRadius: '8px',
          background: i <= current ? 'var(--primary)' : '#e2e8f0',
          transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
        }} />
        {i < total - 1 && <div style={{ width: '20px', height: '2px', background: i < current ? 'var(--primary)' : '#e2e8f0', borderRadius: '2px', transition: 'background 0.4s ease' }} />}
      </React.Fragment>
    ))}
  </div>
);

// ─── Main Wizard ─────────────────────────────────────────────────────────────
const TOTAL_STEPS = 4;

const OnboardingWizard = ({ onComplete, session }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Step state
  const [orgName, setOrgName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [storeName, setStoreName] = useState('');
  const [areaName, setAreaName] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [tipoRespuesta, setTipoRespuesta] = useState('stars');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Saved IDs
  const [savedStoreId, setSavedStoreId] = useState(null);
  const [savedAreaId, setSavedAreaId] = useState(null);

  const STEPS = [
    { icon: <Palette size={26} />, label: t('onboarding.step1_label', 'Identidad'), color: '#3b82f6' },
    { icon: <Building2 size={26} />, label: t('onboarding.step2_label', 'Tu negocio'), color: '#10b981' },
    { icon: <MessageSquare size={26} />, label: t('onboarding.step3_label', 'Tu pregunta'), color: '#8b5cf6' },
    { icon: <QrCode size={26} />, label: t('onboarding.step4_label', 'Tu QR'), color: '#f59e0b' },
  ];

  const transition = (fn) => {
    setAnimating(true);
    setTimeout(() => { fn(); setAnimating(false); }, 220);
  };

  const getRealTenantId = async () => {
    try {
      const saved = localStorage.getItem('saas_tenant_config');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.id && p.id !== '00000000-0000-0000-0000-000000000000') return p.id;
      }
    } catch (_) {}
    const { data } = await supabase.from('tenants').select('id').limit(1).single();
    return data?.id || null;
  };

  // ── Step 0: Save org name
  const saveStep0 = async () => {
    if (!orgName.trim()) return;
    const tid = await getRealTenantId();
    if (tid) await supabase.from('tenants').update({ name: orgName.trim() }).eq('id', tid);
    transition(() => setStep(1));
  };

  // ── Step 1: Save store + area
  const saveStep1 = async () => {
    if (!storeName.trim()) return;
    setSaving(true); setError('');
    try {
      const tid = await getRealTenantId();
      if (!tid) throw new Error('No se encontró el tenant.');

      // 1. Store
      const { data: store, error: storeErr } = await supabase
        .from('Tiendas_Catalogo')
        .insert([{ nombre: storeName.trim(), tenant_id: tid }])
        .select('id').single();
      if (storeErr) throw storeErr;
      setSavedStoreId(store.id);

      // 2. Area (sequential, after store)
      if (areaName.trim()) {
        const { data: area, error: areaErr } = await supabase
          .from('Areas_Catalogo')
          .insert([{ nombre: areaName.trim(), tenant_id: tid, tienda_id: store.id }])
          .select('id').single();
        if (areaErr) throw areaErr;
        setSavedAreaId(area.id);
      }

      transition(() => setStep(2));
    } catch (err) {
      setError(err.message || 'Error al guardar. Intenta de nuevo.');
    }
    setSaving(false);
  };

  // ── Step 2: Save question
  const saveStep2 = async () => {
    if (!questionText.trim()) return;
    setSaving(true); setError('');
    try {
      const tid = await getRealTenantId();
      const targetAreaId = savedAreaId;

      if (targetAreaId && tid) {
        const { error: qErr } = await supabase
          .from('Area_Preguntas')
          .insert([{
            area_id: targetAreaId,
            tenant_id: tid,
            numero_pregunta: 1,
            texto_pregunta: questionText.trim(),
            tipo_respuesta: tipoRespuesta,
            activa: true,
          }]);
        if (qErr) throw qErr;
      }
      transition(() => setStep(3));
    } catch (err) {
      setError(err.message || 'Error al guardar la pregunta.');
    }
    setSaving(false);
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

  const handleSkip = () => {
    localStorage.setItem('onboarding_complete', 'true');
    onComplete();
  };

  const baseUrl = import.meta.env.VITE_FEEDBACK_URL || 'https://priceshoes.netlify.app/feedback';
  const qrUrl = savedStoreId ? `${baseUrl}?t=${savedStoreId}${savedAreaId ? `&a=${savedAreaId}` : ''}` : baseUrl;

  return (
    <>
      {showConfetti && <Confetti />}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #f0fdf4 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif', padding: '1rem', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ width: '100%', maxWidth: '520px', textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <Zap size={20} color="var(--primary)" />
            <span style={{ fontFamily: 'Outfit', fontWeight: '900', fontSize: '1.1rem', color: '#1e293b', letterSpacing: '-0.02em' }}>IANPS</span>
            <span style={{ background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', color: 'white', fontSize: '0.55rem', fontWeight: '800', padding: '2px 7px', borderRadius: '20px', textTransform: 'uppercase' }}>PRO</span>
          </div>

          <StepDots current={step} total={TOTAL_STEPS} />

          {/* Step icons row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', opacity: i <= step ? 1 : 0.3, transition: 'opacity 0.3s' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px',
                  background: i <= step ? s.color : '#e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', transition: 'all 0.3s',
                  boxShadow: i === step ? `0 4px 12px ${s.color}50` : 'none',
                }}>
                  {i < step ? <CheckCircle2 size={16} /> : s.icon}
                </div>
                <span style={{ fontSize: '0.55rem', fontWeight: '700', color: i === step ? '#1e293b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'white', borderRadius: '28px', padding: '2rem',
          width: '100%', maxWidth: '520px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.04)',
          opacity: animating ? 0 : 1, transform: animating ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity 0.22s ease, transform 0.22s ease',
        }}>

          {/* ── STEP 0: Identity ── */}
          {step === 0 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                <div style={{ width: '60px', height: '60px', background: '#eff6ff', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#3b82f6' }}><Palette size={30} /></div>
                <h2 style={{ fontFamily: 'Outfit', fontSize: '1.7rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.4rem', letterSpacing: '-0.03em' }}>
                  {t('onboarding.s1_title', '¡Hola! ¿Cómo se llama tu negocio?')}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: '1.5', margin: 0 }}>
                  {t('onboarding.s1_desc', 'Aparecerá en tus reportes y QRs. Puedes cambiarlo después.')}
                </p>
              </div>
              <label style={labelStyle}>{t('onboarding.name_label', 'Nombre de tu empresa')} *</label>
              <input autoFocus type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && orgName.trim() && saveStep0()}
                placeholder={t('onboarding.name_placeholder', 'ej. Price Shoes Guadalajara')}
                style={inputStyle(!!orgName)} />
              <div style={{ marginTop: '1rem' }}>
                <label style={labelStyle}>{t('onboarding.logo_label', 'Tu logo')} <span style={{ fontWeight: 400, color: '#94a3b8', textTransform: 'none' }}>(opcional)</span></label>
                <label style={uploadStyle(!!logoUrl)}>
                  {logoUrl
                    ? <><img src={logoUrl} alt="logo" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8 }} /><span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>✓ Logo cargado</span></>
                    : <><Palette size={18} color="#94a3b8" /><span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>Seleccionar imagen...</span></>
                  }
                  <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (f) setLogoUrl(URL.createObjectURL(f)); }} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          )}

          {/* ── STEP 1: Store + Area ── */}
          {step === 1 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                <div style={{ width: '60px', height: '60px', background: '#f0fdf4', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#10b981' }}><Building2 size={30} /></div>
                <h2 style={{ fontFamily: 'Outfit', fontSize: '1.7rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.4rem', letterSpacing: '-0.03em' }}>
                  {t('onboarding.s2_title', '¿Dónde opera tu negocio?')}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: '1.5', margin: 0 }}>
                  {t('onboarding.s2_desc', 'Agrega tu primera tienda y área de evaluación.')}
                </p>
              </div>
              <label style={labelStyle}>{t('onboarding.store_label', 'Nombre de la tienda')} *</label>
              <input autoFocus type="text" value={storeName} onChange={e => setStoreName(e.target.value)}
                placeholder={t('onboarding.store_placeholder', 'ej. Sucursal Centro')}
                style={inputStyle(!!storeName)} />
              <div style={{ marginTop: '1rem' }}>
                <label style={labelStyle}>{t('onboarding.area_label', 'Área de evaluación')} <span style={{ fontWeight: 400, color: '#94a3b8', textTransform: 'none' }}>(opcional)</span></label>
                <input type="text" value={areaName} onChange={e => setAreaName(e.target.value)}
                  placeholder={t('onboarding.area_placeholder', 'ej. Cajas, Baños, Atención al Cliente')}
                  style={inputStyle(!!areaName)} />
              </div>
              {error && <ErrorBox msg={error} />}
            </div>
          )}

          {/* ── STEP 2: First Question ── */}
          {step === 2 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ width: '60px', height: '60px', background: '#faf5ff', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#8b5cf6' }}><MessageSquare size={30} /></div>
                <h2 style={{ fontFamily: 'Outfit', fontSize: '1.6rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.4rem', letterSpacing: '-0.03em' }}>
                  {t('onboarding.s3_title', '¿Qué le preguntas a tus clientes?')}
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
                  {t('onboarding.s3_desc', 'Elige el tipo de respuesta y escribe tu pregunta.')}
                </p>
              </div>

              {/* Type picker */}
              <label style={labelStyle}>Tipo de respuesta *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { value: 'stars', emoji: '⭐', title: 'Estrellas (1-5)', desc: 'Calif. de 1 a 5 estrellas' },
                  { value: 'si_no', emoji: '👍', title: 'Sí / No', desc: 'Respuesta binaria' },
                  { value: 'nps', emoji: '📊', title: 'NPS (0-10)', desc: 'Probabilidad de recomendar' },
                  { value: 'emoji', emoji: '😊', title: 'Emojis', desc: 'Sábrosamente intuitivo' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setTipoRespuesta(opt.value)}
                    style={{
                      padding: '0.85rem 1rem', borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                      border: `2px solid ${tipoRespuesta === opt.value ? '#8b5cf6' : '#e2e8f0'}`,
                      background: tipoRespuesta === opt.value ? '#faf5ff' : 'white',
                      transition: 'all 0.2s',
                    }}>
                    <div style={{ fontSize: '1.3rem', marginBottom: '4px' }}>{opt.emoji}</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '800', color: tipoRespuesta === opt.value ? '#7c3aed' : '#1e293b' }}>{opt.title}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              {/* Suggestion chips */}
              <label style={labelStyle}>Tu pregunta *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.75rem' }}>
                {[
                  '¿Cómo calificarías tu experiencia hoy?',
                  '¿El servicio cumplió tus expectativas?',
                  '¿Nos recomendarías a un amigo?',
                  '¿Qué tan satisfecho estás con la atención?',
                ].map(s => (
                  <button key={s} type="button" onClick={() => setQuestionText(s)}
                    style={{ padding: '5px 10px', borderRadius: '20px', border: `1.5px solid ${questionText === s ? '#8b5cf6' : '#e2e8f0'}`,
                      background: questionText === s ? '#faf5ff' : '#f9fafb', color: questionText === s ? '#7c3aed' : '#64748b',
                      fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                    {s}
                  </button>
                ))}
              </div>
              <input autoFocus type="text" value={questionText} onChange={e => setQuestionText(e.target.value)}
                placeholder={t('onboarding.question_placeholder', 'ej. ¿Cómo calificarías tu visita hoy?')}
                style={inputStyle(!!questionText)} />

              {!savedAreaId && (
                <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '0.75rem 1rem', marginTop: '0.75rem', display: 'flex', gap: '10px' }}>
                  <span>⚠️</span>
                  <p style={{ fontSize: '0.75rem', color: '#92400e', margin: 0 }}>
                    No se guardó el área anterior. La pregunta quedará sin asignar — puedes moverla desde Gestión de Preguntas.
                  </p>
                </div>
              )}
              {error && <ErrorBox msg={error} />}
            </div>
          )}

          {/* ── STEP 3: Done! ── */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: '0.75rem' }}>🎉</div>
              <h2 style={{ fontFamily: 'Outfit', fontSize: '2rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.5rem', letterSpacing: '-0.03em' }}>
                {t('onboarding.done_title', '¡Estás listo para despegar!')}
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                {t('onboarding.done_desc', 'Tu tienda, área y primera pregunta están configuradas. Genera tu QR y ponlo en tu negocio. ¡Cada escaneo trae datos reales!')}
              </p>

              {/* Summary */}
              <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                {[
                  { icon: '🏢', label: 'Negocio', val: orgName || '—' },
                  { icon: '📍', label: 'Tienda', val: storeName || '—' },
                  { icon: '🗂️', label: 'Área', val: areaName || '—' },
                  { icon: '❓', label: 'Pregunta', val: questionText || '—' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '1rem' }}>{r.icon}</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, minWidth: 60 }}>{r.label}</span>
                    <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>{r.val}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button onClick={() => handleFinish('/qr')} style={{ padding: '1rem', borderRadius: '14px', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: '800', fontFamily: 'Outfit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 20px rgba(59,130,246,0.3)' }}>
                  <QrCode size={20} /> {t('onboarding.go_qr', 'Generar mi primer QR ahora')}
                </button>
                <button onClick={() => handleFinish(null)} style={{ padding: '0.85rem', borderRadius: '14px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600' }}>
                  {t('onboarding.go_dash', 'Ir al Dashboard primero')}
                </button>
              </div>
            </div>
          )}

          {/* ── Navigation ── */}
          {step < 3 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={step === 0 ? handleSkip : () => transition(() => setStep(s => s - 1))}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                {step === 0 ? t('onboarding.skip', 'Saltar configuración') : <><ArrowLeft size={15} /> {t('onboarding.back', 'Atrás')}</>}
              </button>

              <button
                disabled={saving || (step === 0 ? !orgName.trim() : step === 1 ? !storeName.trim() : !questionText.trim())}
                onClick={step === 0 ? saveStep0 : step === 1 ? saveStep1 : saveStep2}
                style={{
                  padding: '0.8rem 1.75rem', borderRadius: '14px',
                  background: saving || (step === 0 ? !orgName.trim() : step === 1 ? !storeName.trim() : !questionText.trim()) ? '#e2e8f0' : 'linear-gradient(135deg,var(--primary),#8b5cf6)',
                  color: saving || (step === 0 ? !orgName.trim() : step === 1 ? !storeName.trim() : !questionText.trim()) ? '#94a3b8' : 'white',
                  border: 'none', cursor: 'pointer', fontSize: '0.92rem', fontWeight: '800', fontFamily: 'Outfit',
                  display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                  boxShadow: saving ? 'none' : '0 4px 12px rgba(59,130,246,0.2)',
                }}>
                {saving ? t('onboarding.saving', 'Guardando...') : t('onboarding.next', 'Continuar')}
                {!saving && <ArrowRight size={16} />}
              </button>
            </div>
          )}
        </div>

        {step < 3 && (
          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: 6, color: '#cbd5e1' }}>
            <Globe2 size={12} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{t('onboarding.footer', 'Funciona en ES · EN · PT • 100% seguro')}</span>
          </div>
        )}
      </div>
    </>
  );
};

// ─── Shared Styles ────────────────────────────────────────────────────────────
const labelStyle = { fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' };

const inputStyle = (active) => ({
  width: '100%', padding: '0.9rem 1.1rem', borderRadius: '12px',
  border: `2px solid ${active ? 'var(--primary)' : '#e2e8f0'}`,
  fontSize: '0.95rem', fontWeight: 600, outline: 'none',
  transition: 'border-color 0.2s', boxSizing: 'border-box',
});

const uploadStyle = (hasFile) => ({
  display: 'flex', alignItems: 'center', gap: '0.75rem',
  padding: '0.9rem 1.1rem', borderRadius: '12px',
  border: `2px dashed ${hasFile ? '#10b981' : '#e2e8f0'}`,
  cursor: 'pointer', background: hasFile ? '#f0fdf4' : '#fafafa',
  transition: 'all 0.2s',
});

const ErrorBox = ({ msg }) => (
  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '0.75rem 1rem', marginTop: '1rem', display: 'flex', gap: 10 }}>
    <span>⚠️</span>
    <p style={{ fontSize: '0.78rem', color: '#dc2626', margin: 0, fontWeight: 600 }}>{msg}</p>
  </div>
);

export default OnboardingWizard;
