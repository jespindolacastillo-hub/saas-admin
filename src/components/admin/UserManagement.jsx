import React, { useState, useEffect, useCallback } from 'react';
import { UserService } from '../../services/userService';
import { StoreService } from '../../services/storeService';
import { AreaService } from '../../services/areaService';
import {
    Plus, Edit2, Trash2, ShieldCheck,
    UserPlus, X, Save, AlertCircle
} from 'lucide-react';
import { tenantConfig } from '../../config/tenant';

const UserManagement = ({ session }) => {
    // --- Configuration ---
    const superUsers = ['jorge.espindola@priceshoes.com', 'admin@priceshoes.com', 'jec@priceshoes.com', tenantConfig.supportEmail];
    const isSuperUser = superUsers.includes(session?.user?.email);

    // --- State Management ---
    const [activeSection, setActiveSection] = useState('tiendas');
    const [data, setData] = useState({
        tiendas: [],
        areas: [],
        usuarios: [],
        tiendaAreas: []
    });
    const [loading, setLoading] = useState(true);

    // Consolidated Modal State
    const [modal, setModal] = useState({
        show: false,
        type: '', // 'tienda', 'area', 'usuario'
        item: null,
        original: null,
        loading: false
    });

    const [deleteConfirm, setDeleteConfirm] = useState({
        show: false,
        target: null // { type, id, name }
    });

    const [tempSelectedAreas, setTempSelectedAreas] = useState(new Set());

    // --- Data Fetching ---
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const [tiendas, areas, usuarios, tiendaAreas] = await Promise.all([
                StoreService.listStores(),
                AreaService.listAreas(),
                UserService.listUsers(),
                StoreService.listTiendaAreas()
            ]);
            setData({ tiendas, areas, usuarios, tiendaAreas });
        } catch (err) {
            console.error('❌ Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // --- Handlers: Creation & Editing ---
    const openModal = (type, item = null) => {
        const isEdit = !!item;
        setModal({
            show: true,
            type,
            item: isEdit ? { ...item } : {},
            original: isEdit ? { ...item } : null,
            loading: false
        });

        if (type === 'tienda') {
            if (isEdit) {
                const currentAreas = new Set(
                    data.tiendaAreas
                        .filter(ta => ta.tienda_id === item.id && ta.activa)
                        .map(ta => ta.area_id)
                );
                setTempSelectedAreas(currentAreas);
            } else {
                const allActiveAreas = new Set(data.areas.filter(a => a.activa).map(a => a.id));
                setTempSelectedAreas(allActiveAreas);
            }
        }
    };

    const closeModal = () => {
        setModal({ show: false, type: '', item: null, original: null, loading: false });
        setTempSelectedAreas(new Set());
    };

    const handleSave = async () => {
        const { type, item } = modal;
        if (!item.nombre || item.nombre.trim() === '') {
            alert('El nombre es obligatorio');
            return;
        }

        setModal(prev => ({ ...prev, loading: true }));
        try {
            let result;
            if (type === 'usuario') {
                result = await UserService.saveUser(item);
            } else if (type === 'tienda') {
                result = await StoreService.saveStore(item, tempSelectedAreas);
            } else if (type === 'area') {
                result = await AreaService.saveArea(item);
            }

            // Cleanup & Refresh
            closeModal();
            fetchAllData();

            // Note: Audit logging could be moved to services, 
            // but keeping a simple console log here for confirmation
            console.log(`✅ ${type} guardado con éxito:`, result.id);
        } catch (err) {
            alert(`❌ Error al guardar ${type}: ` + err.message);
        } finally {
            setModal(prev => ({ ...prev, loading: false }));
        }
    };

    // --- Handlers: Deletion ---
    const openDelete = (type, id, name) => {
        setDeleteConfirm({ show: true, target: { type, id, name } });
    };

    const confirmDelete = async () => {
        const { target } = deleteConfirm;
        if (!target) return;

        setLoading(true);
        try {
            if (target.type === 'usuario') {
                const user = data.usuarios.find(u => u.id === target.id);
                await UserService.deleteUser(target.id, user?.email);
            } else if (target.type === 'tienda') {
                await StoreService.deleteStore(target.id);
            } else if (target.type === 'area') {
                await AreaService.deleteArea(target.id);
            }

            fetchAllData();
        } catch (err) {
            alert('❌ Error al eliminar: ' + err.message);
        } finally {
            setLoading(false);
            setDeleteConfirm({ show: false, target: null });
        }
    };

    // --- Optimistic Updates ---
    const toggleUserStatus = async (id, currentStatus) => {
        // 1. Optimistic Update
        setData(prev => ({
            ...prev,
            usuarios: prev.usuarios.map(u => u.id === id ? { ...u, activo: !currentStatus } : u)
        }));

        try {
            await UserService.toggleStatus(id, !currentStatus);
        } catch (err) {
            // 2. Revert on error
            alert('⚠️ Error al actualizar estado: ' + err.message);
            setData(prev => ({
                ...prev,
                usuarios: prev.usuarios.map(u => u.id === id ? { ...u, activo: currentStatus } : u)
            }));
        }
    };

    // --- Helpers ---
    const getRolColor = (rol) => {
        const colors = { Admin: '#dc2626', Gerente: '#f59e0b', Usuario: '#3b82f6' };
        return colors[rol] || '#94a3b8';
    };

    // --- Render Logic ---
    if (!isSuperUser && activeSection === 'usuarios') {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <ShieldCheck size={48} style={{ color: '#dc2626', marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>Acceso Restringido</h2>
                <p style={{ color: '#64748b' }}>Solo el Administrador Principal puede gestionar usuarios.</p>
                <button onClick={() => setActiveSection('tiendas')} className="btn btn-primary" style={{ marginTop: '1rem' }}>Volver</button>
            </div>
        );
    }

    if (loading && !data.tiendas.length) return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando administrador...</div>;

    return (
        <div className="animate-in fade-in duration-500">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '700' }}>Administración de Sistema</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Gestión centralizada de infraestructura y accesos.</p>
            </header>

            {/* Navigation Tabs */}
            <nav style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #e2e8f0' }}>
                {['tiendas', 'areas', 'usuarios'].map(section => (
                    <button
                        key={section}
                        onClick={() => setActiveSection(section)}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'none', border: 'none',
                            borderBottom: activeSection === section ? '3px solid var(--primary)' : '3px solid transparent',
                            color: activeSection === section ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: activeSection === section ? '700' : '500',
                            cursor: 'pointer', textTransform: 'capitalize'
                        }}
                    >
                        {section === 'tiendas' ? '🏢' : section === 'areas' ? '📍' : '👥'} {section}
                    </button>
                ))}
            </nav>

            {/* Stores Section */}
            {activeSection === 'tiendas' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                    <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button className="btn btn-primary" onClick={() => openModal('tienda')}><Plus size={18} /> Nueva Tienda</button>
                    </div>
                    {data.tiendas.map(tienda => (
                        <div key={tienda.id} className="card shadow-sm hover-grow">
                            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{tienda.nombre}</h3>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', minHeight: '2.4rem' }}>{tienda.direccion}</p>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
                                <button onClick={() => openModal('tienda', tienda)} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>Editar</button>
                                <button onClick={() => openDelete('tienda', tienda.id, tienda.nombre)} className="btn btn-danger btn-sm">Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Areas Section */}
            {activeSection === 'areas' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                    <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                        <button className="btn btn-primary" onClick={() => openModal('area')}><Plus size={18} /> Nueva Área</button>
                    </div>
                    {data.areas.map(area => (
                        <div key={area.id} className="card shadow-sm" style={{ borderLeft: `4px solid ${area.color}` }}>
                            <h3 style={{ fontWeight: 700 }}>{area.nombre}</h3>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{area.descripcion}</p>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
                                <button onClick={() => openModal('area', area)} className="btn btn-secondary btn-sm">Editar</button>
                                <button onClick={() => openDelete('area', area.id, area.nombre)} className="btn btn-danger btn-sm"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Users Section */}
            {activeSection === 'usuarios' && (
                <div className="card shadow-sm" style={{ overflowX: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                        <button className="btn btn-primary" onClick={() => openModal('usuario')}><UserPlus size={18} /> Nuevo Usuario</button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left', fontSize: '0.7rem', color: '#94a3b8', letterSpacing: '0.05em' }}>
                                <th style={{ padding: '1rem' }}>NOMBRE COMPLETO</th>
                                <th>EMAIL</th>
                                <th>ROL</th>
                                <th>ESTADO</th>
                                <th>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.usuarios.map(u => (
                                <tr key={u.id} className="hover-bg" style={{ borderBottom: '1px solid #f8fafc', fontSize: '0.85rem' }}>
                                    <td style={{ padding: '1rem', fontWeight: 600 }}>{u.nombre} {u.apellido}</td>
                                    <td style={{ color: '#64748b' }}>{u.email}</td>
                                    <td>
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '6px',
                                            background: getRolColor(u.rol) + '15', color: getRolColor(u.rol),
                                            fontSize: '0.75rem', fontWeight: 600
                                        }}>
                                            {u.rol}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => toggleUserStatus(u.id, u.activo)}
                                            className={u.activo ? 'badge badge-success' : 'badge'}
                                            style={{ transition: 'all 0.2s', border: 'none', cursor: 'pointer' }}
                                        >
                                            {u.activo ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => openModal('usuario', u)} className="btn btn-secondary btn-sm" title="Editar"><Edit2 size={14} /></button>
                                            <button onClick={() => openDelete('usuario', u.id, `${u.nombre} ${u.apellido}`)} className="btn btn-danger btn-sm" title="Eliminar"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal: Consolidated Create/Edit */}
            {modal.show && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card scale-in shadow-xl" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h2 style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1e293b' }}>
                                {modal.original ? 'Editar' : 'Nuevo'} {modal.type.charAt(0).toUpperCase() + modal.type.slice(1)}
                            </h2>
                            <button onClick={closeModal} className="hover-rotate" style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="#94a3b8" /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>NOMBRE</label>
                                <input placeholder="Nombre" value={modal.item.nombre || ''} onChange={e => setModal({ ...modal, item: { ...modal.item, nombre: e.target.value } })} className="input" />
                            </div>

                            {modal.type === 'usuario' && (
                                <>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>APELLIDO</label>
                                        <input placeholder="Apellido" value={modal.item.apellido || ''} onChange={e => setModal({ ...modal, item: { ...modal.item, apellido: e.target.value } })} className="input" />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>EMAIL</label>
                                        <input placeholder="Email" disabled={!!modal.original} value={modal.item.email || ''} onChange={e => setModal({ ...modal, item: { ...modal.item, email: e.target.value } })} className="input" />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>ROL DE ACCESO</label>
                                        <select value={modal.item.rol || 'Usuario'} onChange={e => setModal({ ...modal, item: { ...modal.item, rol: e.target.value } })} className="input">
                                            <option value="Admin">Administrador</option>
                                            <option value="Gerente">Gerente de Tienda</option>
                                            <option value="Usuario">Operador / Recepción</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>CONTRASEÑA {modal.original && '(Dejar en blanco para no cambiar)'}</label>
                                        <input type="password" placeholder="Contraseña (mín 6 caps)" value={modal.item.password || ''} onChange={e => setModal({ ...modal, item: { ...modal.item, password: e.target.value } })} className="input" />
                                    </div>
                                </>
                            )}

                            {modal.type === 'area' && (
                                <>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>DESCRIPCIÓN</label>
                                        <textarea placeholder="Descripción del área" value={modal.item.descripcion || ''} onChange={e => setModal({ ...modal, item: { ...modal.item, descripcion: e.target.value } })} className="input" rows={3} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>COLOR DISTINTIVO</label>
                                        <input type="color" value={modal.item.color || '#3b82f6'} onChange={e => setModal({ ...modal, item: { ...modal.item, color: e.target.value } })} style={{ height: 50, width: '100%', cursor: 'pointer', borderRadius: '8px', border: '2px solid #f1f5f9' }} />
                                    </div>
                                </>
                            )}

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button onClick={closeModal} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                                <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }} disabled={modal.loading}>
                                    {modal.loading ? 'Guardando...' : <><Save size={18} style={{ marginRight: '8px' }} /> Guardar Cambios</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Deletion Confirmation */}
            {deleteConfirm.show && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                    <div className="card scale-in shadow-2xl" style={{ maxWidth: 400, textAlign: 'center', padding: '2.5rem' }}>
                        <div style={{ width: '64px', height: '64px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <AlertCircle size={32} color="#dc2626" />
                        </div>
                        <h3 style={{ fontWeight: 800, fontSize: '1.5rem', color: '#1e293b', marginBottom: '0.75rem' }}>¿Seguro que quieres eliminarlo?</h3>
                        <p style={{ fontSize: '0.95rem', color: '#64748b', lineHeight: 1.5 }}>
                            Estás a punto de eliminar permanentemente a <strong>{deleteConfirm.target.name}</strong>. Esta acción no se puede deshacer.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button onClick={() => setDeleteConfirm({ show: false, target: null })} className="btn btn-secondary" style={{ flex: 1 }}>No, cancelar</button>
                            <button onClick={confirmDelete} className="btn btn-danger" style={{ flex: 1 }}>Sí, eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
