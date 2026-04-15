import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { UserPlus, Edit2, Trash2, X, Users, ShieldCheck, Loader, CheckCircle2, AlertCircle } from 'lucide-react';

const T = {
  coral:  '#FF5C3A',
  teal:   '#00C9A7',
  purple: '#7C3AED',
  ink:    '#0D0D12',
  muted:  '#6B7280',
  border: '#E5E7EB',
  bg:     '#F7F8FC',
  card:   '#FFFFFF',
  green:  '#16A34A',
  amber:  '#F59E0B',
  red:    '#DC2626',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const ROLES = ['Admin', 'Gerente', 'Usuario'];
const ROLE_COLORS = { Admin: T.red, Gerente: T.amber, Usuario: T.teal };

const initForm = { nombre: '', apellido: '', email: '', password: '', rol: 'Usuario', activo: true };

export default function UserManagement({ session }) {
  const { tenant } = useTenant();
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(null); // null | { type: 'add'|'edit', user? }
  const [form, setForm]     = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (tenant?.id) loadUsers();
  }, [tenant?.id]);

  const loadUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('Usuarios')
      .select('id, nombre, apellido, email, rol, activo, created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  const openAdd = () => { setForm(initForm); setModal({ type: 'add' }); };
  const openEdit = (u) => { setForm({ nombre: u.nombre || '', apellido: u.apellido || '', email: u.email || '', password: '', rol: u.rol || 'Usuario', activo: u.activo ?? true, id: u.id }); setModal({ type: 'edit', user: u }); };

  const showMsg = (type, text) => { 
    setMessage({ type, text }); 
    if (type !== 'error') setTimeout(() => setMessage(null), 4000); 
  };

  const handleSave = async () => {
    if (!form.nombre || !form.email) {
      showMsg('error', 'Nombre y Email son requeridos.');
      return;
    }
    // Only require password if we are adding and NOT using the invitation flow (but we ARE using it now)
    // Actually, let's just make it optional since Supabase will handle the invite link

    setSaving(true);
    try {
      if (!tenant?.id) throw new Error('No se pudo identificar la empresa. Por favor, refresca la página.');

      if (modal.type === 'add') {
        console.log('🚀 [UserManagement] Invoking admin-api for sync...');
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('admin-api', {
          body: { action: 'sync', email: form.email, password: form.password, nombre: form.nombre, apellido: form.apellido, tenant_id: tenant.id, rol: form.rol },
        });

        if (fnErr) {
          console.error('❌ Edge Function Error:', fnErr);
          throw new Error(`Error de Servidor: ${fnErr.message || 'No se pudo contactar con la función.'}`);
        }

        if (fnData?.success === false) {
          throw new Error(fnData.error || 'Error desconocido al crear usuario');
        }

        showMsg('success', 'Usuario creado correctamente.');
      } else {
        const updates = { nombre: form.nombre, apellido: form.apellido, rol: form.rol, activo: form.activo, updated_at: new Date().toISOString() };
        const { error } = await supabase.from('Usuarios').update(updates).eq('id', form.id).eq('tenant_id', tenant.id);
        if (error) throw error;
        showMsg('success', 'Usuario actualizado.');
      }
      setModal(null);
      loadUsers();
    } catch (err) {
      console.error('❌ UserManagement handleSave error:', err);
      // More descriptive error for the user
      const msg = err.message.includes('non-2xx') 
        ? 'Error de Red: La función de servidor no respondió correctamente. Revisa los logs en Supabase.'
        : err.message;
      
      window.alert('ERROR CRÍTICO AL GUARDAR: ' + msg);
      showMsg('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u) => {
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, activo: !x.activo } : x));
    await supabase.from('Usuarios').update({ activo: !u.activo, updated_at: new Date().toISOString() }).eq('id', u.id).eq('tenant_id', tenant.id);
  };

  const handleDelete = async (u) => {
    setDeleting(u.id);
    try {
      await supabase.functions.invoke('admin-api', { body: { action: 'delete', id: u.id, email: u.email } });
      await supabase.from('Usuarios').delete().eq('id', u.id).eq('tenant_id', tenant.id);
      loadUsers();
    } catch (err) {
      showMsg('error', 'Error al eliminar: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const currentUserEmail = session?.user?.email;

  return (
    <div style={{ fontFamily: font, padding: 28, background: T.bg, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Equipo
          </h1>
          <p style={{ fontSize: '0.85rem', color: T.muted }}>
            Gestiona los usuarios con acceso al panel de administración
          </p>
        </div>
        <button onClick={openAdd} style={{
          padding: '10px 18px', borderRadius: 12, border: 'none',
          background: T.coral, color: '#fff', fontWeight: 700,
          fontSize: '0.88rem', cursor: 'pointer', fontFamily: font,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <UserPlus size={16} /> Nuevo usuario
        </button>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
          background: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
          color: message.type === 'success' ? T.green : T.red,
          fontSize: '0.88rem', fontWeight: 600,
        }}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Table */}
      <div style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={16} color={T.coral} />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: T.ink }}>{users.length} usuario{users.length !== 1 ? 's' : ''}</h3>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <Users size={36} color={T.border} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: '0.9rem', color: T.muted, fontWeight: 500 }}>Aún no hay usuarios en el equipo.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#FAFAFA', borderBottom: `1px solid ${T.border}` }}>
                {['Usuario', 'Email', 'Rol', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const isSelf = u.email === currentUserEmail;
                return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: T.coral + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: T.coral, fontSize: '0.88rem' }}>
                          {(u.nombre?.[0] || u.email?.[0] || '?').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: T.ink }}>{u.nombre} {u.apellido}</div>
                          {isSelf && <div style={{ fontSize: '0.68rem', color: T.teal, fontWeight: 700 }}>Tú</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: T.muted }}>{u.email}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: (ROLE_COLORS[u.rol] || T.muted) + '18', color: ROLE_COLORS[u.rol] || T.muted }}>
                        {u.rol || 'Usuario'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <button onClick={() => !isSelf && toggleStatus(u)} disabled={isSelf}
                        style={{ padding: '4px 12px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, border: 'none', cursor: isSelf ? 'default' : 'pointer', fontFamily: font, background: u.activo ? T.green + '18' : T.muted + '18', color: u.activo ? T.green : T.muted }}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => openEdit(u)} style={{ padding: '6px 12px', borderRadius: 9, border: `1.5px solid ${T.border}`, background: 'none', cursor: 'pointer', color: T.ink, display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 600, fontFamily: font }}>
                          <Edit2 size={13} /> Editar
                        </button>
                        {!isSelf && (
                          <button onClick={() => handleDelete(u)} disabled={deleting === u.id}
                            style={{ padding: '6px 12px', borderRadius: 9, border: 'none', background: T.red + '12', cursor: 'pointer', color: T.red, display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 600, fontFamily: font }}>
                            {deleting === u.id ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: T.card, borderRadius: 20, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            
            {/* Message inside Modal */}
            {message && (
              <div style={{
                padding: '16px 20px', borderRadius: 12, marginBottom: 20,
                display: 'flex', alignItems: 'center', gap: 12,
                background: message.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                color: message.type === 'success' ? T.green : T.red,
                fontSize: '0.9rem', fontWeight: 800,
                border: message.type === 'success' ? `1px solid ${T.green}40` : `1px solid ${T.red}40`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}>
                {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                <div style={{ flex: 1 }}>{message.text}</div>
                <button onClick={() => setMessage(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.5 }}>
                  <X size={16} />
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: T.ink, display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={20} color={T.coral} />
                {modal.type === 'add' ? 'Nuevo usuario' : 'Editar usuario'}
              </h3>
              <button onClick={() => setModal(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.muted }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Nombre *', field: 'nombre', type: 'text', colSpan: 1 },
                { label: 'Apellido', field: 'apellido', type: 'text', colSpan: 1 },
                { label: 'Email *', field: 'email', type: 'email', colSpan: 2, disabled: modal.type === 'edit' },
                modal.type === 'edit' && { label: 'Nueva contraseña (opcional)', field: 'password', type: 'password', colSpan: 2 },
              ].filter(Boolean).map(({ label, field, type, colSpan, disabled }) => (
                <div key={field} style={{ gridColumn: `span ${colSpan}` }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: T.ink, marginBottom: 6, display: 'block' }}>{label}</label>
                  <input
                    type={type} value={form[field]} disabled={disabled}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: '0.88rem', fontFamily: font, color: T.ink, outline: 'none', boxSizing: 'border-box', background: disabled ? '#F9FAFB' : '#fff' }}
                  />
                </div>
              ))}
              {modal.type === 'add' && (
                <div style={{ gridColumn: 'span 2', fontSize: '0.78rem', color: T.muted, background: '#F8FAFC', padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.border}` }}>
                  ℹ️ Se enviará un correo de invitación para que el usuario active su cuenta y defina su contraseña.
                </div>
              )}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: T.ink, marginBottom: 6, display: 'block' }}>Rol</label>
                <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: '0.88rem', fontFamily: font, color: T.ink, outline: 'none', background: '#fff' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {modal.type === 'edit' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
                  <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} id="activo-check" style={{ accentColor: T.coral, width: 16, height: 16 }} />
                  <label htmlFor="activo-check" style={{ fontSize: '0.88rem', fontWeight: 600, color: T.ink, cursor: 'pointer' }}>Activo</label>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: 10, borderRadius: 12, border: `1.5px solid ${T.border}`, background: 'none', color: T.muted, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: font }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: 10, borderRadius: 12, border: 'none', background: saving ? T.muted : T.coral, color: '#fff', fontWeight: 700, fontSize: '0.88rem', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {saving ? (
                  <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> {modal.type === 'add' ? 'Enviando...' : 'Guardando…'}</>
                ) : (
                  modal.type === 'add' ? 'Enviar invitación' : 'Guardar cambios'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
