import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
    AlertTriangle, MessageSquare, Bell, Frown, Smile, Meh,
    AlertCircle, CheckCircle2, Clock, Filter, Mail, Phone
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getTenantId } from '../../config/tenant';

const IssueManagement = ({ issues = [], feedback = [], onIssueUpdate }) => {
    const { t } = useTranslation();
    const [filterStatus, setFilterStatus] = useState(t('issues.filters.all'));
    const [filterSeverity, setFilterSeverity] = useState(t('issues.filters.all'));
    const [activeSubTab, setActiveSubTab] = useState('active'); // 'active' | 'closed'
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [updatingIssue, setUpdatingIssue] = useState(null);
    const [updateForm, setUpdateForm] = useState({ user: '', comment: '', evidence: '' });
    const [responseForm, setResponseForm] = useState({
        respuesta: '',
        medio: 'Email',
        contacto: ''
    });

    // Helper functions
    const getStoreName = (id) => id; // Placeholder, improved if stores passed as prop
    const getAreaName = (id) => id;   // Placeholder

    const createIssue = async (feedbackData) => {
        try {
            const newIssue = {
                feedback_id: feedbackData.id,
                titulo: t('issues.auto_generation.title', { area: feedbackData.area_id || t('issues.auto_generation.unknown_area') }),
                descripcion: feedbackData.comentario,
                categoria: 'Servicio',
                severidad: feedbackData.satisfaccion === 1 ? 'Crítica' : 'Alta',
                tienda_id: feedbackData.tienda_id,
                area_id: feedbackData.area_id,
                estado: 'Abierto'
            };

            const { error } = await supabase.from('Issues').insert([{ ...newIssue, tenant_id: getTenantId() }]);
            if (error) throw error;
            if (onIssueUpdate) onIssueUpdate();
        } catch (err) {
            console.error("Error creating issue:", err);
            alert(t('issues.alerts.create_error') + err.message);
        }
    };

    const updateIssueStatus = async (issueId, newStatus, metadata = null) => {
        try {
            const updates = { estado: newStatus };
            const issue = issues.find(i => i.id === issueId);

            if (newStatus === 'En Progreso' && !issue.fecha_asignacion) {
                updates.fecha_asignacion = new Date().toISOString();
            }

            if (metadata) {
                if (newStatus === 'Resuelto') {
                    updates.fecha_resolucion = new Date().toISOString();
                    updates.resuelto_por = metadata.user;
                    updates.comentario_resolucion = metadata.comment;
                    updates.evidencia_resolucion = metadata.evidence;
                }
                if (newStatus === 'Verificado') {
                    updates.fecha_verificacion = new Date().toISOString();
                    updates.verificado_por = metadata.user;
                    updates.comentario_verificacion = metadata.comment;
                    updates.evidencia_verificacion = metadata.evidence;
                }
            }

            const { error } = await supabase
                .from('Issues')
                .update(updates)
                .eq('id', issueId)
                .eq('tenant_id', getTenantId());

            if (error) throw error;

            if (onIssueUpdate) onIssueUpdate();
            setShowUpdateModal(false);
            setUpdateForm({ user: '', comment: '', evidence: '' });
        } catch (err) {
            console.error("Error updating issue:", err);
            alert(t('issues.alerts.update_error') + err.message);
        }
    };

    const sendCheckResponse = async () => {
        if (!updatingIssue) return;
        try {
            const { error } = await supabase
                .from('Issues')
                .update({
                    respuesta_oficial: responseForm.respuesta,
                    medio_respuesta: responseForm.medio,
                    fecha_respuesta: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', updatingIssue.id);

            if (error) throw error;

            if (onIssueUpdate) onIssueUpdate();
            setShowResponseModal(false);
            setResponseForm({ respuesta: '', medio: 'Email', contacto: '' });
            alert(t('issues.alerts.response_success'));
        } catch (err) {
            console.error("Error sending response:", err);
            alert(t('issues.alerts.response_error') + err.message);
        }
    };

    const shareIssue = (issue, platform) => {
        const text = t('issues.actions.share_text_header', {
            title: issue.titulo,
            store: issue.tienda_id,
            area: issue.area_id,
            severity: t(`issues.severity_labels.${issue.severidad}`),
            desc: issue.descripcion,
            status: t(`issues.status_labels.${issue.estado}`)
        });
        const encodedText = encodeURIComponent(text);

        if (platform === 'whatsapp') {
            window.open(`https://wa.me/?text=${encodedText}`, '_blank');
        } else if (platform === 'email') {
            const subject = t('issues.actions.tracking_subject', { title: issue.titulo });
            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodedText}`;
        }
    };

    const filteredIssues = useMemo(() => {
        return issues.filter(issue => {
            if (!issue) return false;
            const matchesStatus = filterStatus === t('issues.filters.all') || String(issue.estado).trim() === String(filterStatus).trim();
            const matchesSeverity = filterSeverity === t('issues.filters.all') || String(issue.severidad).trim() === String(filterSeverity).trim();
            return matchesStatus && matchesSeverity;
        });
    }, [issues, filterStatus, filterSeverity, t]);

    const activeIssues = filteredIssues.filter(i => i.estado === 'Abierto' || i.estado === 'En Progreso');
    const closedIssues = filteredIssues.filter(i => i.estado === 'Resuelto' || i.estado === 'Verificado');
    const displayIssues = activeSubTab === 'active' ? activeIssues : closedIssues;

    const metrics = useMemo(() => {
        const total = issues.length;
        const abiertos = issues.filter(i => i.estado === 'Abierto').length;
        const enProgreso = issues.filter(i => i.estado === 'En Progreso').length;
        const resueltos = issues.filter(i => i.estado === 'Resuelto' || i.estado === 'Verificado').length;
        const criticos = issues.filter(i => i.severidad === 'Crítica' && i.estado !== 'Resuelto' && i.estado !== 'Verificado').length;

        const resolvedIssues = issues.filter(i => i.fecha_resolucion);
        const avgResolutionTime = resolvedIssues.length > 0
            ? resolvedIssues.reduce((acc, issue) => {
                const start = new Date(issue.fecha_reporte);
                const end = new Date(issue.fecha_resolucion);
                return acc + (end - start) / (1000 * 60 * 60);
            }, 0) / resolvedIssues.length
            : 0;

        return { total, abiertos, enProgreso, resueltos, criticos, avgResolutionTime };
    }, [issues]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Abierto': return '#ef4444';
            case 'En Progreso': return '#f59e0b';
            case 'Resuelto': return '#10b981';
            case 'Verificado': return '#3b82f6';
            default: return '#94a3b8';
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'Crítica': return '#dc2626';
            case 'Alta': return '#f59e0b';
            case 'Media': return '#3b82f6';
            case 'Baja': return '#10b981';
            default: return '#94a3b8';
        }
    };

    const getSLALogic = (issue) => {
        if (issue.estado === 'Resuelto' || issue.estado === 'Verificado') return null;

        const reportDate = new Date(issue.fecha_reporte || issue.created_at);
        const now = new Date();
        const diffHours = (now - reportDate) / (1000 * 60 * 60);

        const slaHours = issue.severidad === 'Crítica' ? 4 : issue.severidad === 'Alta' ? 24 : 48;
        const timeLeft = slaHours - diffHours;

        return {
            hoursLeft: Math.max(0, timeLeft),
            isExpired: timeLeft < 0,
            text: timeLeft < 0 ? t('issues.sla.expired') : t('issues.sla.remaining', { hours: Math.floor(timeLeft) })
        };
    };

    const getAISuggestion = (issue) => {
        const category = issue.categoria || 'Servicio';
        return t(`issues.ai_suggestion.categories.${category}`, { defaultValue: t('issues.ai_suggestion.categories.default') });
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '700' }}>{t('issues.title')}</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('issues.subtitle')}</p>
            </div>

            {/* Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderLeft: '4px solid var(--primary)' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('issues.metrics.total')}</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: '#1e293b', fontFamily: 'Outfit' }}>{metrics.total}</span>
                    </div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)', borderLeft: '4px solid #ef4444' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('issues.metrics.critical')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: '#991b1b', fontFamily: 'Outfit' }}>{metrics.criticos}</span>
                        <AlertTriangle size={20} color="#ef4444" />
                    </div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)', borderLeft: '4px solid #f59e0b' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('issues.status_labels.En Progreso')}</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: '#92400e', fontFamily: 'Outfit' }}>{metrics.enProgreso}</span>
                    </div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)', borderLeft: '4px solid #10b981' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('issues.metrics.efficiency')}</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: '#166534', fontFamily: 'Outfit' }}>
                            {metrics.total > 0 ? Math.round((metrics.resueltos / metrics.total) * 100) : 0}%
                        </span>
                    </div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)', borderLeft: '4px solid #db2777' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#9d174d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('issues.metrics.avg_resolution')}</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: '#831843', fontFamily: 'Outfit' }}>{Math.round(metrics.avgResolutionTime)}</span>
                        <span style={{ fontSize: '0.8rem', color: '#9d174d', fontWeight: '600' }}>{t('issues.metrics.hrs')}</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value={t('issues.filters.all')}>{t('issues.filters.all_states')}</option>
                        <option value="Abierto">{t('issues.status_labels.Abierto')}</option>
                        <option value="En Progreso">{t('issues.status_labels.En Progreso')}</option>
                        <option value="Resuelto">{t('issues.status_labels.Resuelto')}</option>
                        <option value="Verificado">{t('issues.status_labels.Verificado')}</option>
                    </select>
                    <select className="filter-select" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
                        <option value={t('issues.filters.all')}>{t('issues.filters.all_severities')}</option>
                        <option value="Crítica">{t('issues.severity_labels.Crítica')}</option>
                        <option value="Alta">{t('issues.severity_labels.Alta')}</option>
                        <option value="Media">{t('issues.severity_labels.Media')}</option>
                        <option value="Baja">{t('issues.severity_labels.Baja')}</option>
                    </select>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <button
                                onClick={() => setActiveSubTab('active')}
                                style={{
                                    padding: '0.75rem 0.25rem',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    color: activeSubTab === 'active' ? 'var(--primary)' : '#64748b',
                                    borderBottom: `2px solid ${activeSubTab === 'active' ? 'var(--primary)' : 'transparent'}`,
                                    background: 'none', border: 'none', cursor: 'pointer'
                                }}
                            >
                                {t('issues.tabs.active', { count: activeIssues.length })}
                            </button>
                            <button
                                onClick={() => setActiveSubTab('closed')}
                                style={{
                                    padding: '0.75rem 0.25rem',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    color: activeSubTab === 'closed' ? '#10b981' : '#64748b',
                                    borderBottom: `2px solid ${activeSubTab === 'closed' ? '#10b981' : 'transparent'}`,
                                    background: 'none', border: 'none', cursor: 'pointer'
                                }}
                            >
                                {t('issues.tabs.closed', { count: closedIssues.length })}
                            </button>
                        </div>
                    </div>

                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {displayIssues.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                {t('issues.no_results')}
                            </div>
                        ) : (
                            displayIssues.map(issue => (
                                <div key={issue.id} style={{
                                    padding: '1rem',
                                    marginBottom: '1rem',
                                    background: '#f8fafc',
                                    borderRadius: '12px',
                                    border: `2px solid ${getStatusColor(issue.estado)}20`
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '0.25rem' }}>{issue.titulo}</h4>
                                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>{issue.descripcion}</p>

                                            {/* Contact Details */}
                                            {(issue.contact_whatsapp || issue.contact_email) && (
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem' }}>
                                                    {issue.contact_whatsapp && (
                                                        <a
                                                            href={`https://wa.me/52${issue.contact_whatsapp.replace(/\D/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                padding: '4px 8px', borderRadius: '4px',
                                                                background: '#dcfce7', color: '#166534',
                                                                fontSize: '0.7rem', fontWeight: '700', textDecoration: 'none'
                                                            }}
                                                        >
                                                            <MessageSquare size={12} /> {t('issues.actions.whatsapp')}
                                                        </a>
                                                    )}
                                                    {issue.contact_email && (
                                                        <a
                                                            href={`mailto:${issue.contact_email}`}
                                                            style={{
                                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                padding: '4px 8px', borderRadius: '4px',
                                                                background: '#f1f5f9', color: '#475569',
                                                                fontSize: '0.7rem', fontWeight: '700', textDecoration: 'none'
                                                            }}
                                                        >
                                                            <Bell size={12} /> {t('issues.actions.send_email')}
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => shareIssue(issue, 'whatsapp')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#10b981' }} title={t('issues.actions.share_whatsapp')}>
                                                <MessageSquare size={16} />
                                            </button>
                                            <button onClick={() => shareIssue(issue, 'email')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary)' }} title={t('issues.actions.share_email')}>
                                                <Bell size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
                                        <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', background: getStatusColor(issue.estado) + '20', color: getStatusColor(issue.estado) }}>{t(`issues.status_labels.${issue.estado}`)}</span>
                                        <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', background: getSeverityColor(issue.severidad) + '20', color: getSeverityColor(issue.severidad) }}>{t(`issues.severity_labels.${issue.severidad}`)}</span>
                                        {issue.tienda_id && <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '700', background: '#f1f5f9', color: '#475569' }}>{issue.tienda_id}</span>}

                                        {/* SLA Badge */}
                                        {getSLALogic(issue) && (
                                            <span style={{
                                                marginLeft: 'auto',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                background: getSLALogic(issue).isExpired ? '#fee2e2' : '#ecfdf5',
                                                color: getSLALogic(issue).isExpired ? '#991b1b' : '#047857',
                                                border: '1px solid',
                                                borderColor: getSLALogic(issue).isExpired ? '#fca5a5' : '#6ee7b7',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <Clock size={10} /> {t('issues.sla.label', { text: getSLALogic(issue).text })}
                                            </span>
                                        )}
                                    </div>

                                    {/* AI Smart Tip */}
                                    {issue.estado !== 'Verificado' && (
                                        <div style={{
                                            marginBottom: '1rem',
                                            padding: '8px 12px',
                                            background: '#f8fafc',
                                            borderRadius: '8px',
                                            borderLeft: '3px solid var(--primary)',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '8px'
                                        }}>
                                            <div style={{ background: 'var(--primary-light)', padding: '4px', borderRadius: '6px', marginTop: '2px' }}>
                                                <AlertCircle size={14} color="var(--primary)" />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '2px' }}>{t('issues.ai_suggestion.label')}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic' }}>{getAISuggestion(issue)}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {issue.estado === 'Abierto' && (
                                            <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '6px 12px' }} onClick={() => updateIssueStatus(issue.id, 'En Progreso')}>
                                                {t('issues.actions.start')}
                                            </button>
                                        )}
                                        {issue.estado === 'En Progreso' && (
                                            <button className="btn" style={{ fontSize: '0.7rem', padding: '6px 12px', background: '#10b981', color: 'white' }} onClick={() => { setUpdatingIssue({ id: issue.id, nextStatus: 'Resuelto' }); setShowUpdateModal(true); }}>
                                                {t('issues.actions.resolve')}
                                            </button>
                                        )}
                                        {issue.estado === 'Resuelto' && (
                                            <button className="btn btn-primary btn-sm" onClick={() => { setUpdatingIssue({ id: issue.id, nextStatus: 'Verificado' }); setShowUpdateModal(true); }}>
                                                {t('issues.actions.verify')}
                                            </button>
                                        )}

                                        {/* Close the Loop Button */}
                                        {/* Contact & Log Actions */}
                                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {issue.contact_whatsapp && (
                                                <a
                                                    href={`https://wa.me/52${issue.contact_whatsapp.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn"
                                                    style={{
                                                        padding: '6px 10px',
                                                        background: '#25D366',
                                                        color: 'white',
                                                        borderRadius: '6px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        textDecoration: 'none'
                                                    }}
                                                    title={t('issues.actions.open_whatsapp')}
                                                >
                                                    <MessageSquare size={16} />
                                                </a>
                                            )}
                                            {issue.contact_email && (
                                                <a
                                                    href={`mailto:${issue.contact_email}`}
                                                    className="btn"
                                                    style={{
                                                        padding: '6px 10px',
                                                        background: '#3b82f6',
                                                        color: 'white',
                                                        borderRadius: '6px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        textDecoration: 'none'
                                                    }}
                                                    title={t('issues.actions.send_email')}
                                                >
                                                    <Mail size={16} />
                                                </a>
                                            )}

                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => { setUpdatingIssue(issue); setShowResponseModal(true); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                title={issue.respuesta_oficial ? t('issues.actions.view_log') : t('issues.actions.register')}
                                            >
                                                <div style={{ width: '1px', height: '16px', background: '#cbd5e1', marginRight: '4px' }}></div>
                                                {issue.respuesta_oficial ? t('issues.actions.view_log') : t('issues.actions.register')}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Mostrar Respuesta Oficial si existe */}
                                    {issue.respuesta_oficial && (
                                        <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#166534', marginBottom: '2px' }}>{t('issues.official_response.sent')}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#15803d' }}>"{issue.respuesta_oficial}"</div>
                                            <div style={{ fontSize: '0.65rem', color: '#86efac', marginTop: '2px' }}>{t('issues.official_response.via', { medium: t(`issues.modals.media.${issue.medio_respuesta}`), date: new Date(issue.fecha_respuesta).toLocaleDateString() })}</div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="card">
                    <h3 style={{ fontFamily: 'Outfit', fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
                        {t('issues.critical_feedback')}
                        <div className="tooltip-wrapper" style={{ marginLeft: '8px' }}>
                            <AlertCircle size={14} color="#94a3b8" className="help-icon" />
                            <span className="tooltip-content">{t('issues.no_critical')}</span>
                        </div>
                    </h3>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {feedback.filter(f => !issues.some(i => String(i.feedback_id) === String(f.id))).map(f => (
                            <div key={f.id} style={{ padding: '0.75rem', marginBottom: '0.75rem', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>{'⭐'.repeat(f.satisfaccion)}</span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(f.created_at).toLocaleDateString('es-MX')}</span>
                                    <div style={{ marginLeft: 'auto' }}>
                                        {f.sentimiento === 'Negativo' ? <Frown size={14} color="#ef4444" /> : <Meh size={14} color="#f59e0b" />}
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '0.75rem', fontWeight: '500' }}>"{f.comentario}"</p>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.75rem' }}>{getStoreName(f.tienda_id)} • {getAreaName(f.area_id)}</div>
                                <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => createIssue(f)}>{t('issues.create_corrective')}</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Status Update Modal */}
            {showUpdateModal && updatingIssue && (
                <div className="modal-overlay">
                    <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ fontFamily: 'Outfit', fontSize: '1.2rem', marginBottom: '0.5rem' }}>Actualizar Issue</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700' }}>Responsable *</label>
                                <input type="text" className="input" style={{ width: '100%' }} value={updateForm.user} onChange={e => setUpdateForm({ ...updateForm, user: e.target.value })} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700' }}>Comentario de Cierre *</label>
                                <textarea className="input" style={{ width: '100%', minHeight: '80px' }} value={updateForm.comment} onChange={e => setUpdateForm({ ...updateForm, comment: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowUpdateModal(false)}>{t('issues.modals.cancel')}</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => updateIssueStatus(updatingIssue.id, updatingIssue.nextStatus, updateForm)}>{t('issues.modals.confirm')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Close the Loop Modal */}
            {showResponseModal && updatingIssue && (
                <div className="modal-overlay">
                    <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ fontFamily: 'Outfit', fontSize: '1.2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MessageSquare size={20} color="var(--primary)" />
                            {t('issues.modals.official_title')}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.5rem' }}>
                            {t('issues.modals.official_desc')}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700' }}>{t('issues.modals.contact_medium')}</label>
                                <select
                                    className="input"
                                    style={{ width: '100%' }}
                                    value={responseForm.medio}
                                    onChange={e => setResponseForm({ ...responseForm, medio: e.target.value })}
                                >
                                    <option value="Email">{t('issues.modals.media.Email')}</option>
                                    <option value="Teléfono">{t('issues.modals.media.Teléfono')}</option>
                                    <option value="WhatsApp">{t('issues.modals.media.WhatsApp')}</option>
                                    <option value="Presencial">{t('issues.modals.media.Presencial')}</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700' }}>{t('issues.modals.agreements')}</label>
                                <textarea
                                    className="input"
                                    style={{ width: '100%', minHeight: '100px', padding: '0.75rem', fontSize: '0.85rem' }}
                                    placeholder={t('issues.modals.placeholder')}
                                    value={responseForm.respuesta}
                                    onChange={e => setResponseForm({ ...responseForm, respuesta: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowResponseModal(false)}>{t('issues.modals.cancel')}</button>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 1 }}
                                disabled={!responseForm.respuesta}
                                onClick={sendCheckResponse}
                            >
                                {t('issues.modals.register_btn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; alignItems: center; justifyContent: center; z-index: 1000; padding: 1rem; backdrop-filter: blur(2px); }
                .input { border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem; outline: none; transition: border-color 0.2s; }
                .input:focus { border-color: var(--primary); }
            `}</style>
        </div>
    );
};

export default IssueManagement;
