import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Send, CheckCircle2, Loader, Clock, Fingerprint } from 'lucide-react';
import { tenantConfig } from '../config/tenant';
import { useTranslation } from 'react-i18next';

// ─── Retelio inline mark (shown when tenant has no logo) ──────────────────────
const ReteLioMark = ({ size = 'md' }) => {
  const s = size === 'sm' ? 16 : 28;
  const fs = size === 'sm' ? '1rem' : '1.5rem';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: size === 'sm' ? '2px' : '3px', width: s, height: s }}>
        <div style={{ borderRadius: '3px', background: '#FF5C3A' }} />
        <div style={{ borderRadius: '3px', background: '#00C9A7' }} />
        <div style={{ borderRadius: '3px', background: '#7C3AED' }} />
        <div style={{ borderRadius: '3px', background: '#F59E0B' }} />
      </div>
      <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", fontWeight: 900, fontSize: fs, color: 'white', letterSpacing: '-0.03em' }}>retelio</span>
    </div>
  );
};

// ─── Powered by footer badge ──────────────────────────────────────────────────
const PoweredBy = () => (
  <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', width: '14px', height: '14px' }}>
      <div style={{ borderRadius: '2px', background: '#FF5C3A' }} />
      <div style={{ borderRadius: '2px', background: '#00C9A7' }} />
      <div style={{ borderRadius: '2px', background: '#7C3AED' }} />
      <div style={{ borderRadius: '2px', background: '#F59E0B' }} />
    </div>
    <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700' }}>
      Powered by <strong style={{ color: '#64748b' }}>retelio</strong>
    </span>
  </div>
);

const Feedback = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const [tenantId]      = useState(searchParams.get('tid') || tenantConfig.id);
  const [storeId]       = useState(searchParams.get('t') || searchParams.get('tienda_id') || localStorage.getItem('ps_store_id') || '');
  const [areaId]        = useState(searchParams.get('a') || searchParams.get('area_id') || localStorage.getItem('ps_area_id') || '');
  const [qrId]          = useState(searchParams.get('id_qr') || localStorage.getItem('ps_qr_id') || '');
  const [canal]         = useState(searchParams.get('c') || 'QR');
  const [subscriberKey] = useState(searchParams.get('u') || '');

  useEffect(() => {
    const urlStore = searchParams.get('t') || searchParams.get('tienda_id');
    const urlArea  = searchParams.get('a') || searchParams.get('area_id');
    const urlQr    = searchParams.get('id_qr');
    if (urlStore) localStorage.setItem('ps_store_id', urlStore);
    if (urlArea)  localStorage.setItem('ps_area_id', urlArea);
    if (urlQr)    localStorage.setItem('ps_qr_id', urlQr);
  }, [searchParams]);

  const [rating, setRating]                   = useState(parseInt(searchParams.get('r')) || 0);
  const [pregunta2Respuesta, setPregunta2Respuesta] = useState('');
  const [whatsapp, setWhatsapp]               = useState('');
  const [email, setEmail]                     = useState('');
  const [extraInfo, setExtraInfo]             = useState('');

  const [tenantData, setTenantData]           = useState(null);
  const [storeName, setStoreName]             = useState('');
  const [areaDisplayName, setAreaDisplayName] = useState('');
  const [deviceId, setDeviceId]               = useState('');
  const [primaryQuestion, setPrimaryQuestion] = useState(null);  // Area_Preguntas row for q1
  const [questionData, setQuestionData]       = useState(null);  // secondary question

  const [loadingData, setLoadingData]         = useState(true);
  const [submitting, setSubmitting]           = useState(false);
  const [submitted, setSubmitted]             = useState(false);
  const [error, setError]                     = useState('');
  const [cooldown, setCooldown]               = useState(false);
  const [masterMode]                          = useState(localStorage.getItem('ps_master_mode') === 'active');

  const getFingerprint = async () => {
    const components = [navigator.userAgent, navigator.language, screen.colorDepth, screen.width + 'x' + screen.height, new Date().getTimezoneOffset(), !!window.sessionStorage, !!window.localStorage];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top'; ctx.font = "14px 'Arial'"; ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillText(`${tenantData?.name || tenantConfig.name}Fingerprint`, 2, 15);
    components.push(canvas.toDataURL());
    const str = components.join('###');
    let hash = 0;
    for (let i = 0; i < str.length; i++) { const char = str.charCodeAt(i); hash = ((hash << 5) - hash) + char; hash = hash & hash; }
    return 'ps_' + Math.abs(hash).toString(16);
  };

  const handleMasterBypass = () => {
    const pass = prompt('Modo Maestro - Ingrese contraseña:');
    if (pass === '1972') { localStorage.setItem('ps_master_mode', 'active'); window.location.reload(); }
    else if (pass !== null) alert('Contraseña incorrecta');
  };

  useEffect(() => {
    const load = async () => {
      if (tenantId && tenantId !== '00000000-0000-0000-0000-000000000000') {
        try {
          const { data: tData } = await supabase.from('tenants').select('name, logo_url, primary_color').eq('id', tenantId).single();
          if (tData) {
            setTenantData(tData);
            if (tData.primary_color) document.documentElement.style.setProperty('--primary', tData.primary_color);
          }
        } catch (_) {}
      }

      const fingerprint = await getFingerprint();
      setDeviceId(fingerprint);

      if (!masterMode) {
        const lastSubmission = localStorage.getItem(`feedback_sent_${storeId}_${areaId}`);
        if (lastSubmission && (Date.now() - parseInt(lastSubmission)) < 12 * 60 * 60 * 1000) {
          setCooldown(true); setLoadingData(false); return;
        }
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const { data: existing } = await supabase.from('Feedback').select('id').eq('device_id', fingerprint).eq('tienda_id', storeId).eq('area_id', areaId).eq('tenant_id', tenantId).gt('created_at', twelveHoursAgo).limit(1);
        if (existing && existing.length > 0) { setCooldown(true); setLoadingData(false); return; }
      }

      try {
        const [storeRes, areaRes, q1Res, q2Res] = await Promise.all([
          storeId ? supabase.from('Tiendas_Catalogo').select('nombre').eq('id', storeId).eq('tenant_id', tenantId).single() : Promise.resolve({ data: null }),
          areaId  ? supabase.from('Areas_Catalogo').select('nombre').eq('id', areaId).eq('tenant_id', tenantId).single() : Promise.resolve({ data: null }),
          areaId  ? supabase.from('Area_Preguntas').select('*').eq('area_id', areaId).eq('numero_pregunta', 1).eq('activa', true).eq('tenant_id', tenantId).maybeSingle() : Promise.resolve({ data: null }),
          areaId  ? supabase.from('Area_Preguntas').select('*').eq('area_id', areaId).eq('numero_pregunta', 2).eq('activa', true).eq('tenant_id', tenantId).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        if (storeRes.data) setStoreName(storeRes.data.nombre);
        if (areaRes.data)  setAreaDisplayName(areaRes.data.nombre);
        if (q1Res.data)    setPrimaryQuestion(q1Res.data);
        if (q2Res.data)    setQuestionData(q2Res.data);
        else if (areaId)   setQuestionData({ texto_pregunta: '¿El servicio cumplió con tus expectativas?', tipo_respuesta: 'si_no' });
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [storeId, areaId, masterMode, tenantId]);

  const primaryColor = tenantData?.primary_color || '#FF5C3A';
  const tipoRespuesta = primaryQuestion?.tipo_respuesta || 'stars';

  // Whether to show the extended low-rating form
  const isLowRating = (() => {
    if (rating === 0) return false;
    if (tipoRespuesta === 'nps') return rating <= 6;
    if (tipoRespuesta === 'si_no') return rating === 1;
    return rating <= 2;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) { setError(t('feedback.alerts.select_rating')); return; }
    if (isLowRating && !extraInfo) { setError(t('feedback.alerts.more_details')); return; }
    setSubmitting(true); setError('');

    try {
      const { data: feedbackData, error: insErr } = await supabase.from('Feedback').insert([{
        tienda_id: storeId, area_id: areaId, satisfaccion: rating,
        calidad_info: pregunta2Respuesta, id_qr: qrId, comentario: extraInfo,
        device_id: deviceId, canal, subscriber_key: subscriberKey, tenant_id: tenantId,
      }]).select();
      if (insErr) throw insErr;

      if (isLowRating && feedbackData?.length > 0) {
        const contactInfo = [whatsapp && `WhatsApp: ${whatsapp}`, email && `Email: ${email}`].filter(Boolean).join(' | ') || 'No proporcionado';
        await supabase.from('Issues').insert([{
          feedback_id: feedbackData[0].id,
          titulo: `Feedback Crítico: ${rating} ${tipoRespuesta === 'si_no' ? '(No)' : tipoRespuesta === 'nps' ? `NPS ${rating}` : 'Estrellas'}`,
          descripcion: `Comentario: ${extraInfo}\nContacto: ${contactInfo}`,
          categoria: 'Servicio', severidad: rating <= 1 ? 'Crítica' : 'Alta',
          tienda_id: storeId, area_id: areaId, notas: contactInfo,
          contact_whatsapp: whatsapp || null, contact_email: email || null, tenant_id: tenantId,
        }]);
      }

      localStorage.setItem(`feedback_sent_${storeId}_${areaId}`, Date.now().toString());
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError(t('feedback.alerts.error_sending') + (err.message ? ` ${err.message}` : ''));
    }
    setSubmitting(false);
  };

  // ── Loading ──
  if (loadingData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%)' }}>
        <Loader size={36} className="spin" color={primaryColor} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
      </div>
    );
  }

  // ── Success / Cooldown ──
  if (submitted || cooldown) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%)', padding: '20px' }}>
        <div style={{ maxWidth: '400px', width: '100%', background: 'white', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}>
          {/* Header */}
          <div style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${shadeColor(primaryColor, -15)} 100%)`, padding: '2rem 1.5rem', textAlign: 'center' }}>
            {tenantData?.logo_url
              ? <img src={tenantData.logo_url} alt={tenantData.name} style={{ height: '48px', objectFit: 'contain', maxWidth: '140px', background: 'rgba(255,255,255,0.9)', borderRadius: '10px', padding: '8px 14px', marginBottom: '0' }} onError={e => e.target.style.display = 'none'} />
              : <ReteLioMark />}
          </div>
          {/* Body */}
          <div style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
            <div style={{ width: '72px', height: '72px', background: submitted ? '#dcfce7' : '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              {submitted ? <CheckCircle2 size={36} color="#166534" /> : <Clock size={36} color="#92400e" />}
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '900', marginBottom: '0.5rem', color: '#1e293b' }}>
              {submitted ? t('feedback.success_title') : t('feedback.cooldown_title')}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6 }}>
              {submitted ? t('feedback.success_desc') : t('feedback.cooldown_desc')}
            </p>
            {cooldown && (
              <button onClick={handleMasterBypass} style={{ marginTop: '1.5rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', fontSize: '0.7rem', color: '#94a3b8', cursor: 'pointer' }}>
                <Fingerprint size={12} style={{ display: 'inline', marginRight: '4px' }} />Modo Maestro
              </button>
            )}
          </div>
        </div>
        <PoweredBy />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
      </div>
    );
  }

  // ── Main form ──
  return (
    <div style={{
      minHeight: '100vh', padding: '20px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(160deg, ${hexToRgba(primaryColor, 0.08)} 0%, #f8fafc 40%, #eff6ff 100%)`,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: '440px', width: '100%', borderRadius: '28px', overflow: 'hidden', boxShadow: '0 25px 60px -12px rgba(0,0,0,0.12)', background: 'white' }}>

        {/* ══ Header ══ */}
        <div style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${shadeColor(primaryColor, -20)} 100%)`,
          padding: '2rem 1.5rem 2.5rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', top: '-80px', right: '-60px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', bottom: '-50px', left: '-40px', pointerEvents: 'none' }} />

          {/* Logo */}
          <div style={{ position: 'relative', zIndex: 1, marginBottom: '1rem' }}>
            {tenantData?.logo_url
              ? <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.92)', borderRadius: '14px', padding: '10px 18px' }}>
                  <img src={tenantData.logo_url} alt={tenantData.name} style={{ height: '44px', objectFit: 'contain', maxWidth: '150px', display: 'block' }} onError={e => e.target.parentElement.style.display = 'none'} />
                </div>
              : <ReteLioMark />}
          </div>

          {/* Location badge */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {(storeName || areaDisplayName) && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.18)', borderRadius: '100px', padding: '5px 14px', backdropFilter: 'blur(8px)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'rgba(255,255,255,0.95)' }}>
                  📍 {[storeName, areaDisplayName].filter(Boolean).join(' · ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ══ Body ══ */}
        <div style={{ padding: '2rem 1.75rem' }}>
          <form onSubmit={handleSubmit}>

            {/* Primary question */}
            <div style={{ marginBottom: '2rem' }}>
              <p style={{ fontSize: '1.05rem', fontWeight: '800', color: '#1e293b', textAlign: 'center', marginBottom: '1.25rem', lineHeight: 1.35 }}>
                {primaryQuestion?.texto_pregunta || t('feedback.rating_question')}
              </p>

              {/* Stars 1-5 */}
              {(tipoRespuesta === 'stars' || tipoRespuesta === undefined) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                  {[
                    { score: 1, icon: '😠', label: t('feedback.scores.mal') },
                    { score: 2, icon: '😕', label: t('feedback.scores.regular') },
                    { score: 3, icon: '😐', label: t('feedback.scores.bien') },
                    { score: 4, icon: '🙂', label: t('feedback.scores.muy_bien') },
                    { score: 5, icon: '😍', label: t('feedback.scores.excelente') },
                  ].map(e => (
                    <button key={e.score} type="button" onClick={() => setRating(e.score)} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 4px',
                      background: rating === e.score ? hexToRgba(primaryColor, 0.1) : '#f8fafc',
                      border: `2px solid ${rating === e.score ? primaryColor : '#e2e8f0'}`,
                      borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s',
                      transform: rating === e.score ? 'scale(1.08)' : 'none',
                    }}>
                      <span style={{ fontSize: '1.8rem', marginBottom: '4px', filter: rating && rating !== e.score ? 'grayscale(80%) opacity(0.45)' : 'none', transition: 'filter 0.2s' }}>{e.icon}</span>
                      <span style={{ fontSize: '0.52rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', color: rating === e.score ? primaryColor : '#94a3b8' }}>{e.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Emoji (same icons but 3 levels) */}
              {tipoRespuesta === 'emoji' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {[
                    { score: 1, icon: '😞', label: 'Malo' },
                    { score: 2, icon: '😐', label: 'Regular' },
                    { score: 4, icon: '😊', label: 'Bien' },
                    { score: 5, icon: '🤩', label: 'Excelente' },
                  ].map(e => (
                    <button key={e.score} type="button" onClick={() => setRating(e.score)} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0.5rem',
                      background: rating === e.score ? hexToRgba(primaryColor, 0.1) : '#f8fafc',
                      border: `2px solid ${rating === e.score ? primaryColor : '#e2e8f0'}`,
                      borderRadius: '18px', cursor: 'pointer', transition: 'all 0.2s',
                      transform: rating === e.score ? 'scale(1.08)' : 'none',
                    }}>
                      <span style={{ fontSize: '2.2rem', marginBottom: '6px', filter: rating && rating !== e.score ? 'grayscale(80%) opacity(0.45)' : 'none' }}>{e.icon}</span>
                      <span style={{ fontSize: '0.6rem', fontWeight: '700', color: rating === e.score ? primaryColor : '#94a3b8' }}>{e.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Yes / No */}
              {tipoRespuesta === 'si_no' && (
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  {[{ score: 5, label: '👍 Sí', color: '#10B981' }, { score: 1, label: '👎 No', color: '#FF5C3A' }].map(opt => (
                    <button key={opt.score} type="button" onClick={() => setRating(opt.score)} style={{
                      flex: 1, padding: '1.1rem', borderRadius: '20px', fontSize: '1.1rem', fontWeight: '800',
                      border: `2.5px solid ${rating === opt.score ? opt.color : '#e2e8f0'}`,
                      background: rating === opt.score ? hexToRgba(opt.color, 0.08) : '#f8fafc',
                      color: rating === opt.score ? opt.color : '#64748b',
                      cursor: 'pointer', transition: 'all 0.2s',
                      transform: rating === opt.score ? 'scale(1.04)' : 'none',
                    }}>{opt.label}</button>
                  ))}
                </div>
              )}

              {/* NPS 0-10 */}
              {tipoRespuesta === 'nps' && (
                <div>
                  <div className="nps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: '2px', marginBottom: '6px' }}>
                    {Array.from({ length: 11 }, (_, i) => (
                      <button key={i} type="button" onClick={() => setRating(i)} style={{
                        aspectRatio: '1', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '800',
                        border: `2px solid ${rating === i ? primaryColor : '#e2e8f0'}`,
                        background: rating === i ? primaryColor : i <= 6 ? '#fff1f2' : i <= 8 ? '#fffbeb' : '#f0fdf4',
                        color: rating === i ? 'white' : '#374151',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>{i}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#94a3b8', fontWeight: '600' }}>
                    <span>Muy poco probable</span><span>Muy probable</span>
                  </div>
                </div>
              )}
            </div>

            {/* Secondary question */}
            {questionData && rating > 0 && (
              <div style={{ marginBottom: '2rem', animation: 'fadeIn 0.3s ease' }}>
                <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#334155', textAlign: 'center', marginBottom: '0.75rem' }}>{questionData.texto_pregunta}</p>
                {questionData.tipo_respuesta === 'si_no' && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                    {['Sí', 'No'].map(opt => (
                      <button key={opt} type="button" onClick={() => setPregunta2Respuesta(opt)} style={{
                        padding: '0.7rem 1.6rem', borderRadius: '24px', fontWeight: '800', cursor: 'pointer',
                        border: `2px solid ${pregunta2Respuesta === opt ? primaryColor : '#e2e8f0'}`,
                        background: pregunta2Respuesta === opt ? hexToRgba(primaryColor, 0.08) : 'white',
                        color: pregunta2Respuesta === opt ? primaryColor : '#64748b', transition: 'all 0.2s',
                      }}>{opt === 'Sí' ? t('questions.types.si') : t('questions.types.no')}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Low-rating extended form */}
            {isLowRating && (
              <div style={{ marginBottom: '1.75rem', animation: 'fadeIn 0.3s ease' }}>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '16px', padding: '1rem', marginBottom: '1.25rem', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.2rem' }}>💬</span>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#991b1b', fontWeight: '600', lineHeight: 1.4 }}>Sentimos mucho eso. Cuéntanos más para mejorar.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div>
                    <label style={LS}>{t('feedback.improve_label')}</label>
                    <textarea value={extraInfo} onChange={e => setExtraInfo(e.target.value)}
                      placeholder={t('feedback.improve_placeholder')}
                      style={{ width: '100%', padding: '0.9rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', minHeight: '90px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <label style={LS}>{t('feedback.whatsapp_label')}</label>
                    <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                      placeholder={t('feedback.whatsapp_placeholder')}
                      style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={LS}>{t('feedback.email_label')}</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder={t('feedback.email_placeholder')}
                      style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: '#fee2e2', color: '#dc2626', borderRadius: '12px', fontSize: '0.82rem', textAlign: 'center', fontWeight: '600' }}>{error}</div>
            )}

            <button type="submit" disabled={submitting} style={{
              width: '100%', padding: '1.1rem', borderRadius: '18px', border: 'none',
              background: rating === 0 ? '#e2e8f0' : `linear-gradient(135deg, ${primaryColor} 0%, ${shadeColor(primaryColor, -15)} 100%)`,
              color: rating === 0 ? '#94a3b8' : 'white',
              fontSize: '1rem', fontWeight: '800', cursor: rating === 0 || submitting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: rating === 0 ? 'none' : `0 8px 20px ${hexToRgba(primaryColor, 0.35)}`,
              transition: 'all 0.2s',
            }}>
              {submitting ? <Loader size={20} className="spin" /> : <>{t('feedback.submit_btn')} <Send size={18} /></>}
            </button>
          </form>
        </div>

        {/* ══ Footer inside card ══ */}
        <div style={{ padding: '0 1.75rem 1.5rem', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f8fafc', borderRadius: '100px', padding: '5px 12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5px', width: '12px', height: '12px' }}>
              <div style={{ borderRadius: '1.5px', background: '#FF5C3A' }} /><div style={{ borderRadius: '1.5px', background: '#00C9A7' }} />
              <div style={{ borderRadius: '1.5px', background: '#7C3AED' }} /><div style={{ borderRadius: '1.5px', background: '#F59E0B' }} />
            </div>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '700' }}>Powered by <strong style={{ color: '#64748b' }}>retelio</strong></span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .spin { animation: spin 1s linear infinite; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
};

// ─── Color utilities ──────────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  } catch { return `rgba(255,92,58,${alpha})`; }
}

function shadeColor(hex, percent) {
  try {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, Math.min(255, r + percent));
    g = Math.max(0, Math.min(255, g + percent));
    b = Math.max(0, Math.min(255, b + percent));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  } catch { return hex; }
}

const LS = { fontSize: '0.72rem', fontWeight: '800', color: '#374151', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' };

export default Feedback;
