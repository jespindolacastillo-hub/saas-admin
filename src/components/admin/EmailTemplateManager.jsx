import React, { useState, useEffect } from 'react';
import { StoreService } from '../../services/storeService';
import {
    Mail, Copy, ExternalLink, Code,
    Smartphone, Monitor, CheckCircle, Info,
    FlaskConical, Send, Play, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { tenantConfig } from '../../config/tenant';
import { useTranslation } from 'react-i18next';

const EmailTemplateManager = () => {
    const { t } = useTranslation();
    const [stores, setStores] = useState([]);
    const [selectedStore, setSelectedStore] = useState(null);
    const [viewMode, setViewMode] = useState('desktop');
    const [tab, setTab] = useState('full'); // 'full' or 'snippet'
    const [mode, setMode] = useState('editor'); // 'editor' or 'lab'
    const [copied, setCopied] = useState(false);

    // Simulation State
    const [simRating, setSimRating] = useState(5);
    const [simComment, setSimComment] = useState('');
    const [simLoading, setSimLoading] = useState(false);
    const [simResult, setSimResult] = useState(null);

    useEffect(() => {
        const loadStores = async () => {
            try {
                const data = await StoreService.listStores();
                setStores(data);
                if (data.length > 0) setSelectedStore(data[0]);
            } catch (err) {
                console.error('Error loading stores:', err);
            }
        };
        loadStores();
    }, []);

    const feedbackUrl = tenantConfig.feedbackUrl;

    // Salesforce Placeholders
    const sfStoreId = selectedStore ? selectedStore.id : '%%Store_Id%%';
    const sfStoreName = selectedStore ? selectedStore.nombre : '%%Store_Name%%';
    const getRateUrl = (rating) => `${feedbackUrl}?t=${sfStoreId}&a=Email&c=Email&u=%%SubscriberKey%%&r=${rating}`;

    const emojis = [
        { score: 1, icon: '😠', label: t('email.template.emojis.1') },
        { score: 2, icon: '😕', label: t('email.template.emojis.2') },
        { score: 3, icon: '😐', label: t('email.template.emojis.3') },
        { score: 4, icon: '🙂', label: t('email.template.emojis.4') },
        { score: 5, icon: '😍', label: t('email.template.emojis.5') }
    ];

    const fullTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('email.template.subject')} - \${tenantConfig.name}</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { width: 100%; max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
        .header { background-color: #ffffff; padding: 40px 30px; text-align: center; border-bottom: 1px solid #f1f5f9; }
        .content { padding: 40px 30px; text-align: center; }
        .footer { background-color: #f8fafc; padding: 30px; text-align: center; font-size: 12px; color: #94a3b8; }
        .emoji-table { width: 100%; margin: 30px 0; border-collapse: separate; border-spacing: 12px 0; }
        .emoji-cell { width: 20%; background-color: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 20px; text-align: center; }
        .emoji-link { display: block; padding: 20px 5px; text-decoration: none; }
        .emoji-icon { font-size: 36px; display: block; margin-bottom: 10px; }
        .emoji-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2; }
        p { font-size: 17px; color: #64748b; margin-top: 15px; }
        .store-badge { display: inline-block; padding: 6px 16px; background-color: #f1f5f9; border-radius: 24px; font-size: 14px; font-weight: 800; color: #475569; margin-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="\${tenantConfig.logoUrl}" alt="\${tenantConfig.name}" width="140" style="display: block; margin: 0 auto; object-fit: contain;">
        </div>
        <div class="content">
            <h1>${t('email.template.greeting')}</h1>
            <p>${t('email.template.question')}</p>
            <div class="store-badge">${sfStoreName}</div>
            
            <table class="emoji-table">
                <tr>
                    ${emojis.map(e => `
                    <td class="emoji-cell">
                        <a href="${getRateUrl(e.score)}" class="emoji-link">
                            <span class="emoji-icon">${e.icon}</span>
                            <span class="emoji-label">${e.label}</span>
                        </a>
                    </td>`).join('')}
                </tr>
            </table>

            <p style="font-size: 14px; color: #94a3b8;">${t('email.template.footer_tip')}</p>
        </div>
        <div class="footer">
            \${tenantConfig.name} &copy; \${new Date().getFullYear()} • <a href="%%Subscription_Center_URL%%" style="color: #94a3b8;">${t('email.template.unsubscribe')}</a>
        </div>
    </div>
</body>
</html>`.trim();

    const snippetTemplate = `
<!-- Bloque de Emojis Dinámicos (Salesforce Compatible) -->
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 500px; margin: 20px auto;">
    <tr>
        ${emojis.map(e => `
        <td align="center" style="padding: 5px;">
            <a href="${getRateUrl(e.score)}" style="display: block; background-color: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 15px 5px; text-decoration: none; color: #94a3b8;">
                <span style="font-size: 32px; display: block; margin-bottom: 5px; line-height: 1;">${e.icon}</span>
                <span style="font-size: 9px; font-weight: 800; text-transform: uppercase;">${e.label}</span>
            </a>
        </td>`).join('')}
    </tr>
</table>
<!-- Fin del bloque -->`.trim();

    const copyToClipboard = () => {
        const text = tab === 'full' ? fullTemplate : snippetTemplate;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSimulate = async () => {
        if (!selectedStore) return;
        setSimLoading(true);
        setSimResult(null);

        try {
            const payload = {
                tienda_id: selectedStore.id,
                area_id: 'Email',
                satisfaccion: simRating,
                canal: 'Email',
                subscriber_key: 'sim_admin_user',
                comentario: simComment || t('email.lab.sim_placeholder'),
                device_id: 'admin_lab_v1',
                tenant_id: tenantConfig.id
            };

            const { data: fbData, error: fbError } = await supabase
                .from('Feedback')
                .insert([payload])
                .select();

            if (fbError) throw fbError;

            let result = { feedback: fbData[0], issue: null };

            // Simulate Trigger Logic (Frontend Side for visibility)
            if (simRating <= 2) {
                const issuePayload = {
                    feedback_id: fbData[0].id,
                    titulo: t('email.simulation.issue_title', { rating: simRating }),
                    descripcion: t('email.simulation.issue_desc', { comment: payload.comentario }),
                    categoria: 'Servicio',
                    severidad: 'Crítica',
                    tienda_id: payload.tienda_id,
                    area_id: payload.area_id,
                    tenant_id: tenantConfig.id
                };

                const { data: issueData, error: issueError } = await supabase
                    .from('Issues')
                    .insert([issuePayload])
                    .select();

                if (issueError) throw issueError;
                result.issue = issueData[0];
            }

            setSimResult({ success: true, data: result });
        } catch (err) {
            console.error(err);
            setSimResult({ success: false, error: err.message });
        } finally {
            setSimLoading(false);
        }
    };

    return (
        <div className="animate-in fade-in duration-500">
            <header style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '800' }}>{t('email.title')}</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('email.subtitle')}</p>
                    </div>
                    <div style={{ background: '#eff6ff', padding: '10px 16px', borderRadius: '12px', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Info size={18} color="#2563eb" />
                        <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: '600' }}>{t('email.ampscript_active')}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                    <button
                        onClick={() => setMode('editor')}
                        style={{
                            padding: '10px 20px',
                            borderBottom: mode === 'editor' ? '2px solid #2563eb' : '2px solid transparent',
                            color: mode === 'editor' ? '#2563eb' : '#64748b',
                            fontWeight: '700',
                            background: mode === 'editor' ? '#eff6ff' : 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        {t('email.tabs.editor')}
                    </button>
                    <button
                        onClick={() => setMode('lab')}
                        style={{
                            padding: '10px 20px',
                            borderBottom: mode === 'lab' ? '2px solid #8b5cf6' : '2px solid transparent',
                            color: mode === 'lab' ? '#8b5cf6' : '#64748b',
                            fontWeight: '700',
                            background: mode === 'lab' ? '#f5f3ff' : 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <FlaskConical size={18} /> {t('email.tabs.lab')}
                    </button>
                </div>
            </header>

            {mode === 'editor' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '2rem' }}>
                    {/* Sidebar: Config */}
                    <aside>
                        <div className="card shadow-sm" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '1.25rem' }}>{t('email.config.title')}</h3>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{t('email.config.preview_store')}</label>
                                <select
                                    value={selectedStore?.id || ''}
                                    onChange={(e) => setSelectedStore(stores.find(s => s.id === e.target.value))}
                                    className="input"
                                    style={{ fontSize: '0.85rem' }}
                                >
                                    {stores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                </select>
                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '6px' }} dangerouslySetInnerHTML={{ __html: t('email.config.production_hint') }} />
                            </div>

                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                                <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1e293b', marginBottom: '1rem' }}>{t('email.config.sf_variables')}</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {['%%First_Name%%', '%%Tienda_Nombre%%', '%%SubscriberKey%%'].map(v => (
                                        <div key={v} style={{ fontSize: '0.7rem', fontFamily: 'monospace', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#475569' }}>
                                            {v}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={copyToClipboard}
                            className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
                            style={{ width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                        >
                            {copied ? <><CheckCircle size={20} /> {t('email.actions.copied')}</> : <><Copy size={20} /> {t(tab === 'full' ? 'email.actions.copy_full' : 'email.actions.copy_snippet')}</>}
                        </button>
                    </aside>

                    {/* Explorer & Preview */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                                <button
                                    onClick={() => setTab('full')}
                                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: tab === 'full' ? 'white' : 'transparent', boxShadow: tab === 'full' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.75rem', fontWeight: '700', color: tab === 'full' ? 'var(--primary)' : '#64748b' }}
                                >
                                    {t('email.actions.full_template')}
                                </button>
                                <button
                                    onClick={() => setTab('snippet')}
                                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: tab === 'snippet' ? 'white' : 'transparent', boxShadow: tab === 'snippet' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.75rem', fontWeight: '700', color: tab === 'snippet' ? 'var(--primary)' : '#64748b' }}
                                >
                                    {t('email.actions.snippet')}
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setViewMode('desktop')}
                                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: viewMode === 'desktop' ? '#f1f5f9' : 'white', cursor: 'pointer' }}
                                >
                                    <Monitor size={18} color={viewMode === 'desktop' ? 'var(--primary)' : '#94a3b8'} />
                                </button>
                                <button
                                    onClick={() => setViewMode('mobile')}
                                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: viewMode === 'mobile' ? '#f1f5f9' : 'white', cursor: 'pointer' }}
                                >
                                    <Smartphone size={18} color={viewMode === 'mobile' ? 'var(--primary)' : '#94a3b8'} />
                                </button>
                                <button
                                    onClick={() => setViewMode('code')}
                                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: viewMode === 'code' ? '#f1f5f9' : 'white', cursor: 'pointer' }}
                                >
                                    <Code size={18} color={viewMode === 'code' ? 'var(--primary)' : '#94a3b8'} />
                                </button>
                            </div>
                        </div>

                        <div className="card shadow-md" style={{ flex: 1, minHeight: '500px', padding: viewMode === 'code' ? 0 : '2rem', display: 'flex', justifyContent: 'center', background: '#e2e8f0' }}>
                            {viewMode === 'code' ? (
                                <pre style={{ margin: 0, padding: '1.5rem', background: '#1e293b', color: '#cbd5e1', fontSize: '0.8rem', overflow: 'auto', width: '100%', height: '500px', borderRadius: '16px' }}>
                                    {tab === 'full' ? fullTemplate : snippetTemplate}
                                </pre>
                            ) : (
                                <div style={{
                                    width: viewMode === 'mobile' ? '375px' : '100%',
                                    maxWidth: viewMode === 'mobile' ? '375px' : '650px',
                                    height: 'fit-content',
                                    background: 'white',
                                    borderRadius: '24px',
                                    overflow: 'hidden',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                                }}>
                                    <iframe
                                        srcDoc={tab === 'full' ? fullTemplate : `<div style="padding: 40px; text-align: center; font-family: sans-serif;">${snippetTemplate}</div>`}
                                        style={{ width: '100%', height: '500px', border: 'none' }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
                    {/* Lab View: Preview */}
                    <div className="card shadow-sm" style={{ padding: '2rem', background: '#f8fafc', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ marginBottom: '1rem', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '800' }}>{t('email.preview.interactive_title')}</h3>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {t('email.preview.interactive_hint')}
                            </div>
                        </div>

                        <div style={{
                            width: '100%',
                            maxWidth: '650px',
                            background: 'white',
                            borderRadius: '24px',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                            overflow: 'hidden'
                        }}>
                            <iframe
                                srcDoc={fullTemplate.replace(/%%Store_Id%%/g, selectedStore?.id || 'TEST').replace(/%%Store_Name%%/g, selectedStore?.nombre || 'Tienda Test').replace(/%%First_Name%%/g, 'Tester')}
                                style={{ width: '100%', height: '600px', border: 'none' }}
                            />
                        </div>
                    </div>

                    {/* Lab View: Simulator controls */}
                    <div>
                        <div className="card shadow-md" style={{ padding: '1.5rem', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Play size={20} color="#8b5cf6" /> {t('email.lab.title')}
                            </h3>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>{t('email.lab.store')}</label>
                                <div style={{ padding: '10px', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.85rem' }}>
                                    {selectedStore?.nombre || t('email.lab.no_store')}
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>{t('email.lab.sim_rating')}</label>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    {[1, 2, 3, 4, 5].map(r => (
                                        <button
                                            key={r}
                                            onClick={() => setSimRating(r)}
                                            style={{
                                                flex: 1,
                                                padding: '10px',
                                                borderRadius: '8px',
                                                border: simRating === r ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                                                background: simRating === r ? '#f5f3ff' : 'white',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                color: simRating === r ? '#7c3aed' : '#64748b'
                                            }}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>{t('email.lab.sim_comment')}</label>
                                <textarea
                                    value={simComment}
                                    onChange={(e) => setSimComment(e.target.value)}
                                    className="input"
                                    rows="3"
                                    placeholder={t('email.lab.sim_placeholder')}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                />
                            </div>

                            <button
                                onClick={handleSimulate}
                                disabled={simLoading || !selectedStore}
                                className="btn"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: '#8b5cf6',
                                    color: 'white',
                                    borderRadius: '10px',
                                    border: 'none',
                                    fontWeight: '700',
                                    cursor: simLoading || !selectedStore ? 'not-allowed' : 'pointer',
                                    opacity: simLoading || !selectedStore ? 0.7 : 1,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                {simLoading ? t('email.lab.sending') : <><Send size={18} /> {t('email.lab.send_test')}</>}
                            </button>

                            {simResult && (
                                <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '12px', background: simResult.success ? '#f0fdf4' : '#fef2f2', border: simResult.success ? '1px solid #bbf7d0' : '1px solid #fecaca' }}>
                                    <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: simResult.success ? '#166534' : '#991b1b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {simResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                        {simResult.success ? t('email.lab.success') : t('email.lab.error')}
                                    </h4>
                                    {simResult.success && (
                                        <div style={{ fontSize: '0.75rem', color: '#166534' }}>
                                            <p><strong>Feedback ID:</strong> {simResult.data.feedback.id}</p>
                                            <p><strong>Status:</strong> Guardado en BD</p>
                                            {simResult.data.issue ? (
                                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #bbf7d0' }}>
                                                    <p><strong>⚠️ Issue Creado:</strong></p>
                                                    <p>ID: {simResult.data.issue.id}</p>
                                                    <p>Severidad: {simResult.data.issue.severidad}</p>
                                                </div>
                                            ) : (
                                                <p style={{ marginTop: '5px', color: '#64748b' }}>{t('email.lab.no_issue')}</p>
                                            )}
                                        </div>
                                    )}
                                    {!simResult.success && (
                                        <p style={{ fontSize: '0.75rem', color: '#991b1b' }}>{simResult.error}</p>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )
            }
        </div>
    );
};

export default EmailTemplateManager;
