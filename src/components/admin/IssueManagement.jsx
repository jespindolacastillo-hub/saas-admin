import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
    AlertTriangle, MessageSquare, Bell, Frown, Smile, Meh,
    AlertCircle, CheckCircle2, Clock, Filter, Mail, Phone
} from 'lucide-react';

const IssueManagement = ({ issues = [], feedback = [], onIssueUpdate }) => {
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [filterSeverity, setFilterSeverity] = useState('Todos');
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
                titulo: `Problema reportado en ${feedbackData.area_id || 'Área desconocida'}`,
                descripcion: feedbackData.comentario,
                categoria: 'Servicio',
                severidad: feedbackData.satisfaccion === 1 ? 'Crítica' : 'Alta',
                tienda_id: feedbackData.tienda_id,
                area_id: feedbackData.area_id,
                estado: 'Abierto'
            };

            const { error } = await supabase.from('Issues').insert([newIssue]);
            if (error) throw error;
            if (onIssueUpdate) onIssueUpdate();
        } catch (err) {
            console.error("Error creating issue:", err);
            alert("Error al crear el issue: " + err.message);
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
                .eq('id', issueId);

            if (error) throw error;

            if (onIssueUpdate) onIssueUpdate();
            setShowUpdateModal(false);
            setUpdateForm({ user: '', comment: '', evidence: '' });
        } catch (err) {
            console.error("Error updating issue:", err);
            alert("Error al actualizar: " + err.message);
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
            alert("Respuesta registrada exitosamente.");
        } catch (err) {
            console.error("Error sending response:", err);
            alert("Error al registrar respuesta: " + err.message);
        }
    };

    const shareIssue = (issue, platform) => {
        const text = `📌 ISSUE: ${issue.titulo}\n📍 Tienda: ${issue.tienda_id} | Área: ${issue.area_id}\n⚠️ Severidad: ${issue.severidad}\n📝 Descripción: ${issue.descripcion}\n\nEstado actual: ${issue.estado}`;
        const encodedText = encodeURIComponent(text);

        if (platform === 'whatsapp') {
            window.open(`https://wa.me/?text=${encodedText}`, '_blank');
        } else if (platform === 'email') {
            window.location.href = `mailto:?subject=Seguimiento Issue: ${issue.titulo}&body=${encodedText}`;
        }
    };

    const filteredIssues = useMemo(() => {
        return issues.filter(issue => {
            if (!issue) return false;
            const matchesStatus = filterStatus === 'Todos' || String(issue.estado).trim() === String(filterStatus).trim();
            const matchesSeverity = filterSeverity === 'Todos' || String(issue.severidad).trim() === String(filterSeverity).trim();
            return matchesStatus && matchesSeverity;
        });
    }, [issues, filterStatus, filterSeverity]);

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
            text: timeLeft < 0 ? 'Vencido' : `${Math.floor(timeLeft)}h restantes`
        };
    };

    const getAISuggestion = (issue) => {
        const category = issue.categoria || 'Servicio';
        const suggestions = {
            'Servicio': 'Priorizar contacto personal para ofrecer disculpa y compensación inmediata.',
            'Atención': 'Programar sesión de refuerzo en protocolos de servicio al cliente con el equipo.',
            'Limpieza': 'Escalar revisión de bitácoras de mantenimiento y aumentar frecuencia de rondas.',
            'Producto': 'Realizar auditoría selectiva de stock y verificar calidad en piso de venta.',
            'Rapidez': 'Analizar cuellos de botella en horarios pico y optimizar asignación de turnos.'
        };
        return suggestions[category] || 'Revisar antecedentes en esta área para identificar patrones recurrentes.';
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '700' }}>Issue Management</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sistema de seguimiento y resolución de problemas reportados.</p>
            </div>

            {/* Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderLeft: '4px solid var(--primary)' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Issues</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: '#1e293b', fontFamily: 'Outfit' }}>{metrics.total}</span>
                    </div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)', borderLeft: '4px solid #ef4444' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Críticos Abiertos</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: '#991b1b', fontFamily: 'Outfit' }}>{metrics.criticos}</span>
                        <AlertTriangle size={20} color="#ef4444" />
                    </div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)', borderLeft: '4px solid #f59e0b' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>En Progreso</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: '#92400e', fontFamily: 'Outfit' }}>{metrics.enProgreso}</span>
                    </div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)', borderLeft: '4px solid #10b981' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eficiencia</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: '#166534', fontFamily: 'Outfit' }}>
                            {metrics.total > 0 ? Math.round((metrics.resueltos / metrics.total) * 100) : 0}%
                        </span>
                    </div>
                </div>
                <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)', borderLeft: '4px solid #db2777' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#9d174d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolución Promedio</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '2rem', fontWeight: '800', color: '#831843', fontFamily: 'Outfit' }}>{Math.round(metrics.avgResolutionTime)}</span>
                        <span style={{ fontSize: '0.8rem', color: '#9d174d', fontWeight: '600' }}>hrs</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="Todos">Todos los Estados</option>
                        <option value="Abierto">Abierto</option>
                        <option value="En Progreso">En Progreso</option>
                        <option value="Resuelto">Resuelto</option>
                        <option value="Verificado">Verificado</option>
                    </select>
                    <select className="filter-select" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
                        <option value="Todos">Todas las Severidades</option>
                        <option value="Crítica">Crítica</option>
                        <option value="Alta">Alta</option>
                        <option value="Media">Media</option>
                        <option value="Baja">Baja</option>
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
                                Issues Activos ({activeIssues.length})
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
                                Cerrados / Verificados ({closedIssues.length})
                            </button>
                        </div>
                    </div>

                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {displayIssues.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                No hay issues con los filtros seleccionados
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
                                                            <MessageSquare size={12} /> WhatsApp
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
                                                            <Bell size={12} /> Enviar Correo
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => shareIssue(issue, 'whatsapp')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#10b981' }} title="Compartir por WhatsApp">
                                                <MessageSquare size={16} />
                                            </button>
                                            <button onClick={() => shareIssue(issue, 'email')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary)' }} title="Compartir por Email">
                                                <Bell size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', alignItems: 'center' }}>
                                        <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', background: getStatusColor(issue.estado) + '20', color: getStatusColor(issue.estado) }}>{issue.estado}</span>
                                        <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', background: getSeverityColor(issue.severidad) + '20', color: getSeverityColor(issue.severidad) }}>{issue.severidad}</span>
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
                                                <Clock size={10} /> SLA: {getSLALogic(issue).text}
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
                                                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '2px' }}>IA Suggestion</div>
                                                <div style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic' }}>{getAISuggestion(issue)}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {issue.estado === 'Abierto' && (
                                            <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '6px 12px' }} onClick={() => updateIssueStatus(issue.id, 'En Progreso')}>
                                                Iniciar Trabajo
                                            </button>
                                        )}
                                        {issue.estado === 'En Progreso' && (
                                            <button className="btn" style={{ fontSize: '0.7rem', padding: '6px 12px', background: '#10b981', color: 'white' }} onClick={() => { setUpdatingIssue({ id: issue.id, nextStatus: 'Resuelto' }); setShowUpdateModal(true); }}>
                                                Marcar Resuelto
                                            </button>
                                        )}
                                        {issue.estado === 'Resuelto' && (
                                            <button className="btn btn-primary btn-sm" onClick={() => { setUpdatingIssue({ id: issue.id, nextStatus: 'Verificado' }); setShowUpdateModal(true); }}>
                                                Verificar
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
                                                    title="Abrir WhatsApp"
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
                                                    title="Enviar Correo"
                                                >
                                                    <Mail size={16} />
                                                </a>
                                            )}

                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => { setUpdatingIssue(issue); setShowResponseModal(true); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                title="Registrar respuesta en bitácora"
                                            >
                                                <div style={{ width: '1px', height: '16px', background: '#cbd5e1', marginRight: '4px' }}></div>
                                                {issue.respuesta_oficial ? 'Ver Bitácora' : 'Registrar'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Mostrar Respuesta Oficial si existe */}
                                    {issue.respuesta_oficial && (
                                        <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#166534', marginBottom: '2px' }}>✅ Respuesta Oficial Enviada</div>
                                            <div style={{ fontSize: '0.7rem', color: '#15803d' }}>"{issue.respuesta_oficial}"</div>
                                            <div style={{ fontSize: '0.65rem', color: '#86efac', marginTop: '2px' }}>vía {issue.medio_respuesta} • {new Date(issue.fecha_respuesta).toLocaleDateString()}</div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="card">
                    <h3 style={{ fontFamily: 'Outfit', fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
                        Feedback Crítico
                        <div className="tooltip-wrapper" style={{ marginLeft: '8px' }}>
                            <AlertCircle size={14} color="#94a3b8" className="help-icon" />
                            <span className="tooltip-content">Feedback con calificación baja (≤2) sin issue asignado</span>
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
                                <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => createIssue(f)}>Crear Issue Correctivo</button>
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
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowUpdateModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => updateIssueStatus(updatingIssue.id, updatingIssue.nextStatus, updateForm)}>Confirmar</button>
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
                            Respuesta Oficial al Cliente
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.5rem' }}>
                            Registra la respuesta enviada al cliente para cerrar el ciclo de feedback.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700' }}>Medio de contacto</label>
                                <select
                                    className="input"
                                    style={{ width: '100%' }}
                                    value={responseForm.medio}
                                    onChange={e => setResponseForm({ ...responseForm, medio: e.target.value })}
                                >
                                    <option value="Email">Email</option>
                                    <option value="Teléfono">Llamada Telefónica</option>
                                    <option value="WhatsApp">WhatsApp</option>
                                    <option value="Presencial">Reunión Presencial</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700' }}>Respuesta / Acuerdos *</label>
                                <textarea
                                    className="input"
                                    style={{ width: '100%', minHeight: '100px', padding: '0.75rem', fontSize: '0.85rem' }}
                                    placeholder="Describe la solución ofrecida o la respuesta dada al cliente..."
                                    value={responseForm.respuesta}
                                    onChange={e => setResponseForm({ ...responseForm, respuesta: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowResponseModal(false)}>Cancelar</button>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 1 }}
                                disabled={!responseForm.respuesta}
                                onClick={sendCheckResponse}
                            >
                                Registrar Respuesta
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
