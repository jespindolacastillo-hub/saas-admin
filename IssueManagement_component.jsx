// Este archivo contiene el componente IssueManagement
// Copiar este código e insertarlo en App.jsx antes del componente App (línea 555)

const IssueManagement = () => {
    const [issues, setIssues] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [filterSeverity, setFilterSeverity] = useState('Todos');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedFeedback, setSelectedFeedback] = useState(null);

    useEffect(() => {
        fetchIssues();
        fetchCriticalFeedback();
    }, []);

    const fetchIssues = async () => {
        const { data } = await supabase
            .from('Issues')
            .select('*')
            .order('fecha_reporte', { ascending: false });
        if (data) setIssues(data);
        setLoading(false);
    };

    const fetchCriticalFeedback = async () => {
        // Feedback con rating bajo (≤2) y con comentarios
        const { data } = await supabase
            .from('Feedback')
            .select('*')
            .lte('satisfaccion', 2)
            .not('comentarios', 'is', null)
            .order('created_at', { ascending: false })
            .limit(20);
        if (data) setFeedback(data);
    };

    const createIssue = async (feedbackData) => {
        const newIssue = {
            feedback_id: feedbackData.id,
            titulo: `Problema reportado en ${feedbackData.area_id || 'Área desconocida'}`,
            descripcion: feedbackData.comentarios,
            categoria: 'Servicio',
            severidad: feedbackData.satisfaccion === 1 ? 'Crítica' : 'Alta',
            tienda_id: feedbackData.tienda_id,
            area_id: feedbackData.area_id,
            estado: 'Abierto'
        };

        const { error } = await supabase.from('Issues').insert([newIssue]);
        if (!error) {
            fetchIssues();
            setShowCreateModal(false);
        }
    };

    const updateIssueStatus = async (issueId, newStatus) => {
        const updates = { estado: newStatus };

        if (newStatus === 'En Progreso' && !issues.find(i => i.id === issueId).fecha_asignacion) {
            updates.fecha_asignacion = new Date().toISOString();
        }
        if (newStatus === 'Resuelto') {
            updates.fecha_resolucion = new Date().toISOString();
        }
        if (newStatus === 'Verificado') {
            updates.fecha_verificacion = new Date().toISOString();
        }

        const { error } = await supabase
            .from('Issues')
            .update(updates)
            .eq('id', issueId);

        if (!error) fetchIssues();
    };

    const filteredIssues = issues.filter(issue => {
        const matchesStatus = filterStatus === 'Todos' || issue.estado === filterStatus;
        const matchesSeverity = filterSeverity === 'Todos' || issue.severidad === filterSeverity;
        return matchesStatus && matchesSeverity;
    });

    // Métricas
    const metrics = useMemo(() => {
        const total = issues.length;
        const abiertos = issues.filter(i => i.estado === 'Abierto').length;
        const enProgreso = issues.filter(i => i.estado === 'En Progreso').length;
        const resueltos = issues.filter(i => i.estado === 'Resuelto' || i.estado === 'Verificado').length;
        const criticos = issues.filter(i => i.severidad === 'Crítica' && i.estado !== 'Resuelto' && i.estado !== 'Verificado').length;

        // Tiempo promedio de resolución (en horas)
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

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando issues...</div>;

    return (
        <div className="animate-in fade-in duration-500">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '700' }}>Issue Management</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sistema de seguimiento y resolución de problemas reportados.</p>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div className="card">
                    <span className="stat-label">Total Issues</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.5rem' }}>
                        <span className="stat-value" style={{ fontSize: '1.8rem' }}>{metrics.total}</span>
                    </div>
                </div>
                <div className="card">
                    <span className="stat-label">Críticos Abiertos</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.5rem' }}>
                        <span className="stat-value" style={{ fontSize: '1.8rem', color: '#ef4444' }}>{metrics.criticos}</span>
                        <AlertTriangle size={16} color="#ef4444" />
                    </div>
                </div>
                <div className="card">
                    <span className="stat-label">En Progreso</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.5rem' }}>
                        <span className="stat-value" style={{ fontSize: '1.8rem', color: '#f59e0b' }}>{metrics.enProgreso}</span>
                    </div>
                </div>
                <div className="card">
                    <span className="stat-label">Tasa de Resolución</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.5rem' }}>
                        <span className="stat-value" style={{ fontSize: '1.8rem', color: '#10b981' }}>
                            {metrics.total > 0 ? Math.round((metrics.resueltos / metrics.total) * 100) : 0}%
                        </span>
                    </div>
                </div>
                <div className="card">
                    <span className="stat-label">Tiempo Promedio</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.5rem' }}>
                        <span className="stat-value" style={{ fontSize: '1.8rem' }}>{Math.round(metrics.avgResolutionTime)}</span>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>horas</small>
                    </div>
                </div>
            </div>

            {/* Filtros y Acciones */}
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

            {/* Grid: Issues + Feedback Crítico */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                {/* Lista de Issues */}
                <div className="card">
                    <h3 style={{ fontFamily: 'Outfit', fontSize: '1rem', marginBottom: '1rem' }}>Issues Activos</h3>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {filteredIssues.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                No hay issues con los filtros seleccionados
                            </div>
                        ) : (
                            filteredIssues.map(issue => (
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
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '0.7rem',
                                            fontWeight: '600',
                                            background: getStatusColor(issue.estado) + '20',
                                            color: getStatusColor(issue.estado)
                                        }}>
                                            {issue.estado}
                                        </span>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '0.7rem',
                                            fontWeight: '600',
                                            background: getSeverityColor(issue.severidad) + '20',
                                            color: getSeverityColor(issue.severidad)
                                        }}>
                                            {issue.severidad}
                                        </span>
                                        {issue.tienda_id && (
                                            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', background: '#e2e8f0', color: '#475569' }}>
                                                {issue.tienda_id}
                                            </span>
                                        )}
                                        {issue.area_id && (
                                            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', background: '#e2e8f0', color: '#475569' }}>
                                                {issue.area_id}
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                                        <span>📅 {new Date(issue.fecha_reporte).toLocaleDateString('es-MX')}</span>
                                        {issue.fecha_resolucion && (
                                            <span>✅ Resuelto: {new Date(issue.fecha_resolucion).toLocaleDateString('es-MX')}</span>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {issue.estado === 'Abierto' && (
                                            <button
                                                className="btn btn-primary"
                                                style={{ fontSize: '0.7rem', padding: '6px 12px' }}
                                                onClick={() => updateIssueStatus(issue.id, 'En Progreso')}
                                            >
                                                Iniciar Trabajo
                                            </button>
                                        )}
                                        {issue.estado === 'En Progreso' && (
                                            <button
                                                className="btn"
                                                style={{ fontSize: '0.7rem', padding: '6px 12px', background: '#10b981', color: 'white' }}
                                                onClick={() => updateIssueStatus(issue.id, 'Resuelto')}
                                            >
                                                Marcar Resuelto
                                            </button>
                                        )}
                                        {issue.estado === 'Resuelto' && (
                                            <button
                                                className="btn"
                                                style={{ fontSize: '0.7rem', padding: '6px 12px', background: '#3b82f6', color: 'white' }}
                                                onClick={() => updateIssueStatus(issue.id, 'Verificado')}
                                            >
                                                Verificar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Feedback Crítico Sin Issue */}
                <div className="card">
                    <h3 style={{ fontFamily: 'Outfit', fontSize: '1rem', marginBottom: '1rem' }}>
                        Feedback Crítico
                        <div className="tooltip-wrapper" style={{ marginLeft: '8px' }}>
                            <AlertCircle size={14} color="#94a3b8" className="help-icon" />
                            <span className="tooltip-content">
                                Feedback con calificación baja (≤2) que aún no tiene un issue asignado
                            </span>
                        </div>
                    </h3>
                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {feedback.filter(f => !issues.some(i => i.feedback_id === f.id)).map(f => (
                            <div key={f.id} style={{
                                padding: '0.75rem',
                                marginBottom: '0.75rem',
                                background: '#fef2f2',
                                borderRadius: '10px',
                                border: '1px solid #fecaca'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>{'⭐'.repeat(f.satisfaccion)}</span>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                        {new Date(f.created_at).toLocaleDateString('es-MX')}
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '0.5rem' }}>
                                    {f.comentarios}
                                </p>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                                    {f.tienda_id} • {f.area_id}
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ fontSize: '0.7rem', padding: '4px 10px', width: '100%' }}
                                    onClick={() => createIssue(f)}
                                >
                                    Crear Issue
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
