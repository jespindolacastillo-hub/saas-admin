import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Send, CheckCircle2, Loader, Clock, Fingerprint } from 'lucide-react';
import { tenantConfig } from '../config/tenant';

const Feedback = () => {
    const [searchParams] = useSearchParams();

    // URL Params
    // URL Params & Persistence
    const [storeId] = useState(searchParams.get('t') || searchParams.get('tienda_id') || localStorage.getItem('ps_store_id') || '');
    const [areaId] = useState(searchParams.get('a') || searchParams.get('area_id') || localStorage.getItem('ps_area_id') || '');
    const [qrId] = useState(searchParams.get('id_qr') || localStorage.getItem('ps_qr_id') || '');
    const [canal] = useState(searchParams.get('c') || 'QR');
    const [subscriberKey] = useState(searchParams.get('u') || '');

    // Save to LocalStorage if present in URL
    useEffect(() => {
        const urlStore = searchParams.get('t') || searchParams.get('tienda_id');
        const urlArea = searchParams.get('a') || searchParams.get('area_id');
        const urlQr = searchParams.get('id_qr');

        if (urlStore) localStorage.setItem('ps_store_id', urlStore);
        if (urlArea) localStorage.setItem('ps_area_id', urlArea);
        if (urlQr) localStorage.setItem('ps_qr_id', urlQr);
    }, [searchParams]);

    // Form State
    const [rating, setRating] = useState(parseInt(searchParams.get('r')) || 0);
    const [pregunta2Respuesta, setPregunta2Respuesta] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [email, setEmail] = useState('');
    const [extraInfo, setExtraInfo] = useState('');

    // Catalog & Device State
    const [storeName, setStoreName] = useState('');
    const [areaDisplayName, setAreaDisplayName] = useState('');
    const [deviceId, setDeviceId] = useState('');

    // Question State
    const [questionData, setQuestionData] = useState(null);
    const [loadingData, setLoadingData] = useState(true);

    // UI State
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [cooldown, setCooldown] = useState(false);
    const [masterMode, setMasterMode] = useState(localStorage.getItem('ps_master_mode') === 'active');

    // Fingerprinting
    const getFingerprint = async () => {
        const components = [
            navigator.userAgent,
            navigator.language,
            screen.colorDepth,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            !!window.sessionStorage,
            !!window.localStorage
        ];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillText(`\${tenantConfig.name}Fingerprint`, 2, 15);
        components.push(canvas.toDataURL());
        const str = components.join('###');
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'ps_' + Math.abs(hash).toString(16);
    };

    const handleMasterBypass = () => {
        const pass = prompt('Modo Maestro - Ingrese contraseña:');
        if (pass === '1972') {
            localStorage.setItem('ps_master_mode', 'active');
            setMasterMode(true);
            setCooldown(false);
            alert('¡Modo Maestro Activado! Bloqueo de 12h desactivado.');
        } else if (pass !== null) {
            alert('Contraseña incorrecta');
        }
    };

    useEffect(() => {
        const loadInitialData = async () => {
            const fingerprint = await getFingerprint();
            setDeviceId(fingerprint);

            // 1. Check Fraud (Local)
            if (!masterMode) {
                const lastSubmission = localStorage.getItem(`feedback_sent_${storeId}_${areaId}`);
                if (lastSubmission) {
                    const timePassed = Date.now() - parseInt(lastSubmission);
                    if (timePassed < 12 * 60 * 60 * 1000) {
                        setCooldown(true);
                        setLoadingData(false);
                        return;
                    }
                }
            }

            if (!masterMode) {
                const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
                const { data: existing } = await supabase
                    .from('Feedback')
                    .select('id')
                    .eq('device_id', fingerprint)
                    .eq('tienda_id', storeId)
                    .eq('area_id', areaId)
                    .eq('tenant_id', tenantConfig.id)
                    .gt('created_at', twelveHoursAgo)
                    .limit(1);

                if (existing && existing.length > 0) {
                    setCooldown(true);
                    setLoadingData(false);
                    return;
                }
            }

            try {
                if (!masterMode) {
                    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
                    const { data: existing } = await supabase
                        .from('Feedback')
                        .select('id')
                        .eq('device_id', deviceId)
                        .eq('tienda_id', storeId)
                        .eq('area_id', areaId)
                        .eq('tenant_id', tenantConfig.id)
                        .gt('created_at', twelveHoursAgo)
                        .limit(1);

                    if (existing && existing.length > 0) {
                        setCooldown(true);
                        setLoadingData(false);
                        return;
                    }
                }

                // 3. Load Names and Questions
                const [storeRes, areaRes, questionRes] = await Promise.all([
                    storeId ? supabase.from('Tiendas_Catalogo').select('nombre').eq('id', storeId).eq('tenant_id', tenantConfig.id).single() : Promise.resolve({ data: null }),
                    areaId ? supabase.from('Areas_Catalogo').select('nombre').eq('id', areaId).eq('tenant_id', tenantConfig.id).single() : Promise.resolve({ data: null }),
                    areaId ? supabase.from('Area_Preguntas').select('*').eq('area_id', areaId).eq('numero_pregunta', 2).eq('activa', true).eq('tenant_id', tenantConfig.id).single() : Promise.resolve({ data: null })
                ]);

                if (storeRes.data) setStoreName(storeRes.data.nombre);
                if (areaRes.data) setAreaDisplayName(areaRes.data.nombre);
                if (questionRes.data) setQuestionData(questionRes.data);
                else if (areaId) setQuestionData({ texto_pregunta: '¿El servicio cumplió con tus expectativas?', tipo_respuesta: 'si_no' });

            } catch (err) {
                console.error(err);
            } finally {
                setLoadingData(false);
            }
        };
        loadInitialData();
    }, [storeId, areaId, masterMode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) { setError('Por favor selecciona una calificación'); return; }
        if (rating <= 2 && !extraInfo) { setError('Por favor cuéntanos un poco más para poder mejorar.'); return; }

        setSubmitting(true);
        setError('');

        try {
            const { data: feedbackData, error: insErr } = await supabase
                .from('Feedback')
                .insert([{
                    tienda_id: storeId,
                    area_id: areaId,
                    satisfaccion: rating,
                    calidad_info: pregunta2Respuesta,
                    id_qr: qrId,
                    comentario: extraInfo,
                    device_id: deviceId,
                    canal: canal,
                    subscriber_key: subscriberKey,
                    tenant_id: tenantConfig.id
                }])
                .select();

            if (insErr) throw insErr;

            if (rating <= 2 && feedbackData && feedbackData.length > 0) {
                const contactInfo = [
                    whatsapp && `WhatsApp: ${whatsapp}`,
                    email && `Email: ${email}`
                ].filter(Boolean).join(' | ') || 'No proporcionado';

                await supabase.from('Issues').insert([{
                    feedback_id: feedbackData[0].id,
                    titulo: `Feedback Crítico: ${rating} Estrellas`,
                    descripcion: `Comentario: ${extraInfo}\nContacto: ${contactInfo}`,
                    categoria: 'Servicio',
                    severidad: rating === 1 ? 'Crítica' : 'Alta',
                    tienda_id: storeId,
                    area_id: areaId,
                    notas: contactInfo,
                    contact_whatsapp: whatsapp || null,
                    contact_email: email || null,
                    tenant_id: tenantConfig.id
                }]);
            }

            localStorage.setItem(`feedback_sent_${storeId}_${areaId}`, Date.now().toString());
            setSubmitted(true);
        } catch (err) {
            console.error('Submission Error:', err);
            let msg = 'Error al enviar. Intenta de nuevo.';
            if (err.message) msg += ` Detalle: ${err.message}`;
            if (err.details) msg += ` (${err.details})`;
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingData) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                <Loader size={40} className="spin" color="var(--primary)" />
            </div>
        );
    }

    if (cooldown || submitted) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
                <div style={{ maxWidth: '450px', width: '100%', background: 'white', padding: '3rem 2rem', borderRadius: '32px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                    <div style={{ width: '80px', height: '80px', background: submitted ? '#dcfce7' : '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                        {submitted ? <CheckCircle2 size={40} color="#166534" /> : <Clock size={40} color="#92400e" />}
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>{submitted ? '¡Muchas gracias!' : '¡Ya te escuchamos!'}</h2>
                    <p style={{ color: '#64748b' }}>{submitted ? 'Tus comentarios nos ayudan a ser mejores para ti.' : 'Ya recibimos tu opinión recientemente. Valoramos mucho tu tiempo.'}</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div style={{ maxWidth: '450px', width: '100%', background: 'white', padding: '2.5rem 1.5rem', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)', position: 'relative' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <img src={tenantConfig.logoUrl} alt={tenantConfig.name} style={{ maxWidth: '120px', marginBottom: '1.5rem', objectFit: 'contain' }} />
                    <h1 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '0.5rem', color: '#1e293b' }}>
                        Tu opinión es importante
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                        Califica tu experiencia en:
                    </p>
                    <div style={{
                        marginTop: '0.75rem',
                        display: 'inline-block',
                        padding: '6px 16px',
                        background: '#f1f5f9',
                        borderRadius: '24px',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        color: '#475569'
                    }}>
                        {storeName || areaDisplayName ? `${storeName || storeId} • ${areaDisplayName || areaId}` : 'Servicio General'}
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '2.5rem' }}>
                        <label style={{ display: 'block', fontSize: '1rem', fontWeight: '700', marginBottom: '1.25rem', color: '#334155', textAlign: 'center' }}>
                            ¿Cómo calificaría el trato y amabilidad de la persona que le atendió hoy?
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                            {[
                                { score: 1, icon: '😠', label: 'Mal' },
                                { score: 2, icon: '😕', label: 'Regular' },
                                { score: 3, icon: '😐', label: 'Bien' },
                                { score: 4, icon: '🙂', label: 'Muy Bien' },
                                { score: 5, icon: '😍', label: 'Excelente' }
                            ].map((e) => (
                                <button
                                    key={e.score}
                                    type="button"
                                    onClick={() => setRating(e.score)}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        padding: '12px 2px',
                                        background: rating === e.score ? '#f0f9ff' : '#ffffff',
                                        border: rating === e.score ? '2.5px solid #2563eb' : '1px solid #e2e8f0',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        transform: rating === e.score ? 'scale(1.05)' : 'none'
                                    }}
                                >
                                    <span style={{ fontSize: '1.8rem', marginBottom: '4px', filter: rating && rating !== e.score ? 'grayscale(100%) opacity(0.5)' : 'none' }}>{e.icon}</span>
                                    <span style={{ fontSize: '0.55rem', fontWeight: '800', textTransform: 'uppercase', color: rating === e.score ? '#2563eb' : '#94a3b8' }}>{e.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {questionData && (
                        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                            <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: '700', marginBottom: '1rem', color: '#334155' }}>
                                {questionData.texto_pregunta}
                            </label>
                            {questionData.tipo_respuesta === 'si_no' && (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                                    {['Sí', 'No'].map((opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => setPregunta2Respuesta(opt)}
                                            style={{
                                                padding: '0.75rem 1.8rem',
                                                borderRadius: '24px',
                                                border: pregunta2Respuesta === opt ? '2.5px solid #2563eb' : '1.5px solid #e2e8f0',
                                                background: pregunta2Respuesta === opt ? '#eff6ff' : 'white',
                                                color: pregunta2Respuesta === opt ? '#2563eb' : '#64748b',
                                                fontWeight: '800',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                minWidth: '90px'
                                            }}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {rating > 0 && rating <= 2 && (
                        <div style={{ marginBottom: '2rem', animation: 'fadeIn 0.3s ease-out' }}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.5rem', color: '#475569' }}>¿Cómo podemos mejorar? (Obligatorio)</label>
                                <textarea
                                    value={extraInfo}
                                    onChange={(e) => setExtraInfo(e.target.value)}
                                    placeholder="Cuéntanos más detalles..."
                                    style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', minHeight: '100px', fontSize: '0.9rem', outline: 'none' }}
                                />
                            </div>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.5rem', color: '#475569' }}>📱 WhatsApp (Opcional)</label>
                                <input
                                    type="text"
                                    value={whatsapp}
                                    onChange={(e) => setWhatsapp(e.target.value)}
                                    placeholder="Ej: 5512345678"
                                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }}
                                />
                            </div>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.5rem', color: '#475569' }}>✉️ Correo electrónico (Opcional)</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ejemplo@correo.com"
                                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }}
                                />
                            </div>
                        </div>
                    )}

                    {error && <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: '#fee2e2', color: '#dc2626', borderRadius: '12px', fontSize: '0.85rem', textAlign: 'center', fontWeight: '600' }}>{error}</div>}

                    <button
                        type="submit"
                        disabled={submitting}
                        style={{
                            width: '100%',
                            padding: '1.25rem',
                            background: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '16px',
                            fontSize: '1.1rem',
                            fontWeight: '800',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
                            transition: 'all 0.2s'
                        }}
                    >
                        {submitting ? <Loader size={20} className="spin" /> : <>Enviar Calificación <Send size={20} /></>}
                    </button>
                </form>
            </div>

            <div style={{ marginTop: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>
                <p>{tenantConfig.name} © {new Date().getFullYear()} • v1.7</p>
            </div>
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default Feedback;
