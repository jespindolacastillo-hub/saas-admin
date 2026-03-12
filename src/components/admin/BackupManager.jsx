import React, { useState, useEffect } from 'react';
import { ConfigService } from '../../services/configService';
import {
    History, Database, RotateCcw, Plus,
    Trash2, AlertTriangle, CheckCircle2, Clock,
    ChevronRight, Save, Loader
} from 'lucide-react';

const BackupManager = () => {
    const [snapshots, setSnapshots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newSnapshot, setNewSnapshot] = useState({ nombre: '', descripcion: '' });

    const [restoreConfirmation, setRestoreConfirmation] = useState(null);

    useEffect(() => {
        loadSnapshots();
    }, []);

    const loadSnapshots = async () => {
        setLoading(true);
        try {
            const data = await ConfigService.listSnapshots();
            setSnapshots(data);
        } catch (err) {
            setError('Error al cargar respaldos: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newSnapshot.nombre.trim()) return;
        setActionLoading(true);
        try {
            await ConfigService.createSnapshot(newSnapshot.nombre, newSnapshot.descripcion);
            setSuccess('Respaldo creado con éxito');
            setShowCreateModal(false);
            setNewSnapshot({ nombre: '', descripcion: '' });
            await loadSnapshots();
        } catch (err) {
            setError('Error al crear respaldo: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRestore = async () => {
        if (!restoreConfirmation) return;
        setActionLoading(true);
        try {
            await ConfigService.restoreSnapshot(restoreConfirmation.id);
            setSuccess('Sistema restaurado exitosamente');
            setRestoreConfirmation(null);
            // Podríamos forzar un reload de la app si es necesario
            setTimeout(() => window.location.reload(), 2000);
        } catch (err) {
            setError('Error al restaurar: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este punto de restauración?')) return;
        try {
            await ConfigService.deleteSnapshot(id);
            await loadSnapshots();
        } catch (err) {
            setError('Error al eliminar: ' + err.message);
        }
    };

    if (loading) return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            <Loader size={24} className="spin" /> Cargando historial de respaldos...
        </div>
    );

    return (
        <div className="animate-in fade-in duration-500">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '800' }}>Puntos de Restauración</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Administra y restaura el estado de tus catálogos.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Plus size={20} /> Crear Punto de Restauración
                </button>
            </header>

            {success && (
                <div style={{ background: '#dcfce7', color: '#166534', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={20} /> {success}
                </div>
            )}

            {error && (
                <div style={{ background: '#fee2e2', color: '#dc2626', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={20} /> {error}
                </div>
            )}

            <div className="card shadow-sm" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b' }}>Fecha y Origen</th>
                            <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b' }}>Resumen de Datos</th>
                            <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b' }}>Descripción</th>
                            <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {snapshots.map(snap => (
                            <tr key={snap.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: snap.is_auto ? '#eff6ff' : '#f5f3ff', display: 'flex', justifyContent: 'center', alignItems: 'center', color: snap.is_auto ? '#2563eb' : '#7c3aed' }}>
                                            {snap.is_auto ? <History size={20} /> : <Database size={20} />}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: '800' }}>{snap.nombre}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={12} /> {new Date(snap.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#f1f5f9', borderRadius: '20px', color: '#64748b' }}>{snap.num_tiendas} Tiendas</span>
                                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#f1f5f9', borderRadius: '20px', color: '#64748b' }}>{snap.num_areas} Áreas</span>
                                    </div>
                                </td>
                                <td style={{ padding: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
                                    {snap.descripcion || '(Sin descripción)'}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        <button
                                            onClick={() => setRestoreConfirmation(snap)}
                                            className="btn btn-secondary-outline"
                                            style={{ color: '#2563eb', borderColor: '#bfdbfe', padding: '6px 12px', fontSize: '0.75rem' }}
                                        >
                                            <RotateCcw size={14} style={{ marginRight: '4px' }} /> Restaurar
                                        </button>
                                        <button
                                            onClick={() => handleDelete(snap.id)}
                                            style={{ padding: '6px', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal de Creación */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content animate-in zoom-in" style={{ width: '400px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.5rem' }}>Nuevo Punto de Restauración</h2>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="label">Nombre del Respaldo</label>
                            <input
                                type="text"
                                className="input"
                                value={newSnapshot.nombre}
                                onChange={e => setNewSnapshot({ ...newSnapshot, nombre: e.target.value })}
                                placeholder="Ej: Antes de actualización de precios"
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '2rem' }}>
                            <label className="label">Descripción (Opcional)</label>
                            <textarea
                                className="input"
                                value={newSnapshot.descripcion}
                                onChange={e => setNewSnapshot({ ...newSnapshot, descripcion: e.target.value })}
                                style={{ minHeight: '80px', resize: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                            <button onClick={handleCreate} disabled={actionLoading} className="btn btn-primary" style={{ flex: 1 }}>
                                {actionLoading ? <Loader className="spin" /> : 'Crear Respaldo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Restauración */}
            {restoreConfirmation && (
                <div className="modal-overlay">
                    <div className="modal-content animate-in zoom-in" style={{ width: '450px', border: '2px solid #ef4444' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{ width: '60px', height: '60px', borderRadius: '30px', background: '#fee2e2', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#ef4444', marginBottom: '1.5rem' }}>
                                <AlertTriangle size={32} />
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>¿Restaurar Configuración?</h2>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
                                Estás a punto de sobrescribir todos los catálogos actuales con los datos de <strong>"{restoreConfirmation.nombre}"</strong>.
                                Esta acción es irreversible y afectará a todas las tiendas en tiempo real.
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => setRestoreConfirmation(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                            <button onClick={handleRestore} disabled={actionLoading} className="btn" style={{ flex: 1, background: '#ef4444', color: 'white' }}>
                                {actionLoading ? <Loader className="spin" /> : 'Sí, Restaurar Todo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; alignItems: center; z-index: 1000; }
                .modal-content { background: white; padding: 2.5rem; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
                .btn-secondary-outline { border: 1.5px solid #e2e8f0; background: transparent; cursor: pointer; border-radius: 10px; font-weight: 700; transition: all 0.2s; display: flex; alignItems: center; }
                .btn-secondary-outline:hover { background: #f8fafc; border-color: #cbd5e1; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default BackupManager;
