import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import {
  Plus, Edit2, Copy, Check, X, Save, AlertCircle, Loader,
  Share2, Users, ToggleLeft, ToggleRight, FileText, Phone, Mail,
  Building2, QrCode,
} from 'lucide-react';

const T = {
  coral:  '#FF5C3A', teal:  '#00C9A7', purple: '#7C3AED',
  ink:    '#0D0D12', muted: '#6B7280', border: '#E5E7EB',
  bg:     '#F7F8FC', card:  '#FFFFFF', green:  '#16A34A',
  amber:  '#F59E0B', red:   '#EF4444',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const REFERRAL_BASE = import.meta.env.VITE_LANDING_URL || 'https://retelio.com.mx';

// Convierte nombre a slug: "Juan Pérez" → "juan-perez"
function toSlug(str) {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={handle} title="Copiar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? T.teal : T.muted, padding: '2px 4px', display: 'flex', alignItems: 'center' }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function Badge({ color = T.teal, children }) {
  return (
    <span style={{ background: color + '18', color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
      {children}
    </span>
  );
}

// ── PDF one-pager ─────────────────────────────────────────────────────────────
function printOnePager(distributor) {
  const refUrl = `${REFERRAL_BASE}?ref=${distributor.code}`;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Distribuidor — ${distributor.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#0D0D12;padding:48px;max-width:700px;margin:0 auto;}
    .logo{font-size:26px;font-weight:800;color:#FF5C3A;letter-spacing:-0.5px;margin-bottom:6px;}
    .logo span{color:#0D0D12;}
    .tagline{font-size:13px;color:#6B7280;margin-bottom:36px;}
    .card{border:1.5px solid #E5E7EB;border-radius:16px;padding:28px 32px;display:flex;gap:32px;align-items:flex-start;margin-bottom:28px;}
    .qr-wrap{flex-shrink:0;background:#F7F8FC;border-radius:12px;padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px;}
    .qr-label{font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.06em;}
    .info h2{font-size:22px;font-weight:800;color:#0D0D12;margin-bottom:4px;}
    .info .company{font-size:14px;color:#6B7280;font-weight:600;margin-bottom:18px;}
    .field{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px;color:#374151;}
    .field svg{flex-shrink:0;color:#6B7280;}
    .code-box{background:#F3F0FF;border:1.5px solid #7C3AED30;border-radius:10px;padding:14px 20px;margin-bottom:28px;}
    .code-box .lbl{font-size:11px;font-weight:700;color:#7C3AED;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;}
    .code-box .url{font-size:14px;font-weight:600;color:#0D0D12;word-break:break-all;}
    .code-box .code{font-family:monospace;font-size:18px;font-weight:800;color:#7C3AED;margin-top:6px;}
    .steps h3{font-size:14px;font-weight:800;color:#0D0D12;margin-bottom:14px;}
    .step{display:flex;gap:12px;margin-bottom:12px;align-items:flex-start;}
    .step-num{width:24px;height:24px;border-radius:50%;background:#FF5C3A;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
    .step-text{font-size:13px;color:#374151;line-height:1.5;}
    .footer{margin-top:36px;padding-top:20px;border-top:1px solid #E5E7EB;font-size:11px;color:#9CA3AF;text-align:center;}
    @media print{body{padding:32px;}}
  </style>
</head>
<body>
  <div class="logo">retelio<span>.com.mx</span></div>
  <div class="tagline">Plataforma de retroalimentación para negocios</div>

  <div class="card">
    <div class="qr-wrap">
      <div class="qr-label">Mi link único</div>
      <div id="qr-container"></div>
      <div class="qr-label" style="color:#0D0D12;font-size:11px;">${distributor.code}</div>
    </div>
    <div class="info">
      <h2>${distributor.name}</h2>
      ${distributor.company ? `<div class="company">${distributor.company}</div>` : '<div style="margin-bottom:18px"></div>'}
      ${distributor.whatsapp ? `<div class="field"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 012 1.18 2 2 0 014 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>${distributor.whatsapp}</div>` : ''}
      ${distributor.email ? `<div class="field"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>${distributor.email}</div>` : ''}
    </div>
  </div>

  <div class="code-box">
    <div class="lbl">Tu link personalizado de referido</div>
    <div class="url">${refUrl}</div>
    <div class="code">${distributor.code}</div>
  </div>

  <div class="steps">
    <h3>¿Cómo funciona?</h3>
    <div class="step"><div class="step-num">1</div><div class="step-text">Comparte tu link único con negocios que quieran mejorar su servicio.</div></div>
    <div class="step"><div class="step-num">2</div><div class="step-text">Cuando se registren usando tu link, quedan vinculados a ti automáticamente.</div></div>
    <div class="step"><div class="step-num">3</div><div class="step-text">Recibes comisión por cada cliente activo que traigas a la plataforma.</div></div>
  </div>

  <div class="footer">retelio.com.mx · La plataforma de feedback que transforma opiniones en acción</div>

  <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
  <script>
    QRCode.toCanvas(
      document.createElement('canvas'),
      '${refUrl}',
      { width: 150, margin: 1, color: { dark: '#0D0D12', light: '#F7F8FC' } },
      function(err, canvas) {
        if (!err) {
          document.getElementById('qr-container').appendChild(canvas);
          setTimeout(() => window.print(), 400);
        }
      }
    );
  </script>
</body>
</html>`);
  win.document.close();
}

// ── Form modal ────────────────────────────────────────────────────────────────
const EMPTY = { id: null, name: '', company: '', whatsapp: '', email: '', code: '', active: true };

function DistributorForm({ distributor, tenantId, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY, ...distributor });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [codeEdited, setCodeEdited] = useState(!!distributor?.id);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleNameChange = (v) => {
    set('name', v);
    if (!codeEdited) set('code', toSlug(v));
  };

  const handleCodeChange = (v) => {
    setCodeEdited(true);
    set('code', toSlug(v));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setErr('El nombre es requerido.');
    if (!form.code.trim()) return setErr('El código es requerido.');
    setSaving(true); setErr(null);
    try {
      const payload = {
        name: form.name.trim(),
        company: form.company.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        code: form.code.trim(),
        active: form.active,
        tenant_id: tenantId,
      };
      if (form.id) {
        const { error } = await supabase.from('distributors').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('distributors').insert(payload);
        if (error) throw error;
      }
      onSave();
    } catch (ex) {
      setErr(ex.message?.includes('unique') ? 'Ese código ya está en uso, elige otro.' : ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: T.card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, fontFamily: font, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.ink }}>
            {form.id ? 'Editar distribuidor' : 'Nuevo distribuidor'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}><X size={18} /></button>
        </div>

        {err && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{err}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 14 }}>
            <label style={labelStyle}>
              Nombre completo *
              <input value={form.name} onChange={e => handleNameChange(e.target.value)} style={inputStyle} placeholder="Juan García" required />
            </label>

            <label style={labelStyle}>
              Empresa / Negocio
              <input value={form.company} onChange={e => set('company', e.target.value)} style={inputStyle} placeholder="García Consultores" />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={labelStyle}>
                WhatsApp
                <input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} style={inputStyle} placeholder="+52 55 1234 5678" />
              </label>
              <label style={labelStyle}>
                Email
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle} placeholder="juan@email.com" />
              </label>
            </div>

            <label style={labelStyle}>
              Código de referido
              <input
                value={form.code}
                onChange={e => handleCodeChange(e.target.value)}
                style={inputStyle}
                placeholder="juan-garcia"
                maxLength={40}
              />
              <span style={{ fontSize: 11, color: T.muted, fontWeight: 400, marginTop: 3, display: 'block' }}>
                retelio.com.mx/?ref=<strong>{form.code || '…'}</strong>
              </span>
            </label>

            <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span>Distribuidor activo</span>
              <button type="button" onClick={() => set('active', !form.active)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: form.active ? T.teal : T.muted }}>
                {form.active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <button type="button" onClick={onClose} style={btnGhost}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── QR preview modal ──────────────────────────────────────────────────────────
function QRPreview({ distributor, onClose, onPrint }) {
  const refUrl = `${REFERRAL_BASE}?ref=${distributor.code}`;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: T.card, borderRadius: 16, padding: 32, width: '100%', maxWidth: 340, fontFamily: font, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 4 }}>{distributor.name}</div>
        {distributor.company && <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>{distributor.company}</div>}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <QRCodeSVG value={refUrl} size={200} bgColor="#fff" fgColor={T.ink} level="M" />
        </div>
        <div style={{ fontSize: 11, color: T.muted, wordBreak: 'break-all', marginBottom: 20, fontFamily: 'monospace', background: T.bg, borderRadius: 8, padding: '8px 12px' }}>{refUrl}</div>
        <button onClick={onPrint} style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>
          <FileText size={15} /> Generar PDF one-pager
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DistributorsManager() {
  const { tenant } = useTenant();
  const [distributors, setDistributors] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [preview, setPreview]     = useState(null);
  const [msg, setMsg]             = useState(null);

  const load = useCallback(async () => {
    if (!tenant?.id || tenant.id === '00000000-0000-0000-0000-000000000000') return;
    setLoading(true);
    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });
    if (!error) setDistributors(data || []);
    setLoading(false);
  }, [tenant?.id]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = () => {
    setShowForm(false);
    setEditing(null);
    setMsg({ type: 'ok', text: 'Distribuidor guardado.' });
    load();
  };

  const handleToggle = async (d) => {
    await supabase.from('distributors').update({ active: !d.active }).eq('id', d.id);
    load();
  };

  const handleDelete = async (d) => {
    if (!window.confirm(`¿Eliminar a ${d.name}? Esta acción no se puede deshacer.`)) return;
    await supabase.from('distributors').delete().eq('id', d.id);
    setMsg({ type: 'ok', text: 'Distribuidor eliminado.' });
    load();
  };

  const activeCount = distributors.filter(d => d.active).length;

  return (
    <div style={{ fontFamily: font }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.ink }}>Distribuidores</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: T.muted }}>Gestiona tu red de distribuidores y sus links únicos de referido</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={btnPrimary}>
          <Plus size={15} /> Nuevo distribuidor
        </button>
      </div>

      {msg && (
        <div style={{ background: msg.type === 'ok' ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${msg.type === 'ok' ? '#86EFAC' : '#FCA5A5'}`, borderRadius: 8, padding: '10px 14px', color: msg.type === 'ok' ? '#15803D' : '#DC2626', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {msg.text}
          <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}><X size={14} /></button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: <Share2 size={18} />, label: 'Distribuidores activos', value: activeCount, color: T.teal },
          { icon: <Users size={18} />, label: 'Total', value: distributors.length, color: T.purple },
          { icon: <QrCode size={18} />, label: 'Links únicos', value: distributors.length, color: T.coral },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: s.color + '18', borderRadius: 10, padding: 10, color: s.color, display: 'flex' }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.ink, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader size={22} style={{ animation: 'spin 1s linear infinite', color: T.teal }} />
          </div>
        ) : distributors.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Share2 size={32} color={T.muted} style={{ marginBottom: 12 }} />
            <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>No hay distribuidores todavía.</p>
            <button onClick={() => setShowForm(true)} style={{ ...btnPrimary, marginTop: 14 }}>
              <Plus size={14} /> Agregar el primero
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                {['Distribuidor', 'Código', 'Link de referido', 'Contacto', 'Estado', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {distributors.map((d, i) => {
                const refUrl = `${REFERRAL_BASE}?ref=${d.code}`;
                return (
                  <tr key={d.id} style={{ borderTop: i > 0 ? `1px solid ${T.border}` : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: T.ink }}>{d.name}</div>
                      {d.company && <div style={{ fontSize: 11, color: T.muted, fontWeight: 500, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={10} />{d.company}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, background: T.purple + '12', color: T.purple, borderRadius: 6, padding: '2px 8px' }}>{d.code}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 12, color: T.muted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{refUrl}</span>
                        <CopyButton text={refUrl} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {d.whatsapp && <span style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{d.whatsapp}</span>}
                        {d.email && <span style={{ fontSize: 12, color: T.muted, display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={11} />{d.email}</span>}
                        {!d.whatsapp && !d.email && <span style={{ color: T.muted, fontSize: 12 }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge color={d.active ? T.teal : T.muted}>{d.active ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                    <td style={{ padding: '12px 10px 12px 0', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setPreview(d)} title="Ver QR y generar PDF"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.coral, padding: '4px 6px' }}>
                        <FileText size={15} />
                      </button>
                      <button onClick={() => { setEditing(d); setShowForm(true); }} title="Editar"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: '4px 6px' }}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleToggle(d)} title={d.active ? 'Desactivar' : 'Activar'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: d.active ? T.teal : T.muted, padding: '4px 6px' }}>
                        {d.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <DistributorForm
          distributor={editing}
          tenantId={tenant?.id}
          onSave={handleSaved}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {preview && (
        <QRPreview
          distributor={preview}
          onClose={() => setPreview(null)}
          onPrint={() => { printOnePager(preview); setPreview(null); }}
        />
      )}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const labelStyle  = { fontSize: 12, fontWeight: 700, color: T.muted, display: 'flex', flexDirection: 'column', gap: 4 };
const inputStyle  = { display: 'block', width: '100%', marginTop: 2, padding: '8px 11px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", outline: 'none', boxSizing: 'border-box', background: '#F9FAFB' };
const btnPrimary  = { background: T.coral, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" };
const btnGhost    = { background: 'transparent', color: T.muted, border: '1px solid #E5E7EB', borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" };
const thStyle     = { padding: '8px 16px', textAlign: 'left', fontWeight: 700, color: T.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' };
