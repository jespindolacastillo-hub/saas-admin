import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { getPlanLimits, withinLimit } from '../../config/planLimits';
import {
  Plus, Download, Printer, Zap, MapPin, Lock,
  QrCode, Copy, Check, MoreVertical, Pause, Play,
  ChevronDown, ChevronUp,
} from 'lucide-react';

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
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const QR_TYPES = [
  { value: 'area',     label: 'Área / Mesa',    color: T.teal   },
  { value: 'employee', label: 'Empleado',        color: T.purple },
  { value: 'shift',    label: 'Turno',           color: T.coral  },
  { value: 'product',  label: 'Producto',        color: '#F59E0B'},
  { value: 'event',    label: 'Evento',          color: '#EC4899'},
  { value: 'channel',  label: 'Canal',           color: '#06B6D4'},
];

const getTypeInfo = (val) => QR_TYPES.find(t => t.value === val) || QR_TYPES[0];

// ─── Upgrade Banner ───────────────────────────────────────────────────────────
function UpgradeBanner({ message }) {
  return (
    <div style={{
      background: '#FFF7ED', border: `1px solid #FED7AA`, borderRadius: 14,
      padding: '14px 20px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12, marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: T.coral + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Lock size={15} color={T.coral} />
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400E' }}>{message}</span>
      </div>
      <a href="/ajustes" style={{ textDecoration: 'none' }}>
        <button style={{
          background: T.coral, color: '#fff', border: 'none', borderRadius: 9,
          padding: '7px 16px', fontFamily: font, fontWeight: 700, fontSize: '0.78rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}>
          <Zap size={13} fill="white" /> Mejorar plan
        </button>
      </a>
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700,
          color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

const inputSt = {
  width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10,
  padding: '10px 12px', fontFamily: font, fontSize: '0.88rem', outline: 'none',
  boxSizing: 'border-box', background: '#fff', color: T.ink,
};

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={handleCopy} title="Copiar URL" style={{
      background: copied ? T.teal + '15' : T.bg,
      border: `1px solid ${copied ? T.teal + '40' : T.border}`,
      borderRadius: 7, padding: '5px 8px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s',
    }}>
      {copied
        ? <><Check size={12} color={T.teal} /><span style={{ fontSize: '0.65rem', fontWeight: 700, color: T.teal }}>URL copiada</span></>
        : <><Copy size={12} color={T.muted} /><span style={{ fontSize: '0.65rem', fontWeight: 600, color: T.muted }}>Copiar URL</span></>
      }
    </button>
  );
}

// ─── Download / Print ─────────────────────────────────────────────────────────
function downloadQR(id, label) {
  const svg = document.getElementById(id);
  if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas  = document.createElement('canvas');
  canvas.width  = 400; canvas.height = 400;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 400, 400);
    ctx.drawImage(img, 0, 0, 400, 400);
    const a = document.createElement('a');
    a.download = `QR-${label}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
}

function printQR(url, label, locationName) {
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>QR - ${label}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap');
      body { display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0;
             font-family:'Plus Jakarta Sans',sans-serif; flex-direction:column; background:#fff; }
      .loc  { font-size:1rem; font-weight:800; color:#0D0D12; margin-bottom:4px; }
      .lbl  { font-size:0.85rem; color:#6B7280; font-weight:600; margin-bottom:20px; }
      canvas{ border-radius:12px; }
      .brand{ font-size:0.65rem; color:#D1D5DB; margin-top:14px; font-weight:600; }
    </style></head><body>
    <div class="loc">${locationName || ''}</div>
    <div class="lbl">${label}</div>
    <div id="qr"></div>
    <div class="brand">retelio.com.mx</div>
    <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
    <script>QRCode.toCanvas(document.createElement('canvas'),'${url}',{width:260,margin:2},function(err,canvas){document.getElementById('qr').appendChild(canvas);window.print();});</script>
    </body></html>
  `);
  win.document.close();
}

// ─── QR Card ──────────────────────────────────────────────────────────────────
function QRCard({ qr, location, onToggle }) {
  const url      = `${window.location.origin}/f/${qr.id}`;
  const svgId    = `qr-${qr.id}`;
  const typeInfo = getTypeInfo(qr.type);

  return (
    <div style={{
      border: `1.5px solid ${qr.active ? T.border : '#F3F4F6'}`,
      borderRadius: 16, padding: '18px 16px', textAlign: 'center',
      opacity: qr.active ? 1 : 0.55,
      background: qr.active ? '#fff' : '#FAFAFA',
      display: 'flex', flexDirection: 'column', gap: 12,
      transition: 'all 0.2s',
      boxShadow: qr.active ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
    }}>
      {/* QR code */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ padding: 10, background: '#fff', borderRadius: 12,
          border: `1px solid ${T.border}`, display: 'inline-block' }}>
          <QRCodeSVG id={svgId} value={url} size={130} level="M" />
        </div>
      </div>

      {/* Label + type */}
      <div>
        <p style={{ fontSize: '0.88rem', fontWeight: 800, color: T.ink, margin: '0 0 6px' }}>
          {qr.label}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, borderRadius: 999,
            padding: '3px 9px', background: typeInfo.color + '15', color: typeInfo.color,
          }}>
            {typeInfo.label}
          </span>
          <span style={{ fontSize: '0.68rem', color: T.muted, fontWeight: 500 }}>
            {qr.scan_count} scan{qr.scan_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <button onClick={() => downloadQR(svgId, qr.label)} title="Descargar PNG" style={{
            background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            fontSize: '0.72rem', fontWeight: 600, color: T.muted, fontFamily: font,
          }}>
            <Download size={13} /> PNG
          </button>
          <button onClick={() => printQR(url, qr.label, location?.name)} title="Imprimir" style={{
            background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            fontSize: '0.72rem', fontWeight: 600, color: T.muted, fontFamily: font,
          }}>
            <Printer size={13} /> Imprimir
          </button>
          <button onClick={() => onToggle(qr)} style={{
            background: qr.active ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${qr.active ? '#FECACA' : '#BBF7D0'}`,
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: '0.72rem', fontWeight: 700, fontFamily: font,
            color: qr.active ? T.coral : T.green,
          }}>
            {qr.active ? <><Pause size={12} /> Pausar</> : <><Play size={12} /> Activar</>}
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <CopyButton text={url} />
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function QRStudio() {
  const { tenant } = useTenant();
  const [locations,   setLocations]   = useState([]);
  const [qrCodes,     setQrCodes]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [showLocForm, setShowLocForm] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [collapsed,   setCollapsed]   = useState({});

  const [qrForm,  setQrForm]  = useState({ location_id: '', type: 'area', label: '' });
  const [locForm, setLocForm] = useState({ name: '', google_review_url: '', whatsapp_number: '' });

  useEffect(() => { if (tenant?.id) loadData(); }, [tenant?.id]);

  const loadData = async () => {
    setLoading(true);
    const [locRes, qrRes] = await Promise.all([
      supabase.from('locations').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('qr_codes').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
    ]);
    if (locRes.data) setLocations(locRes.data);
    if (qrRes.data)  setQrCodes(qrRes.data);
    setLoading(false);
  };

  const planLimits      = getPlanLimits(tenant?.plan);
  const canAddLocation  = withinLimit(locations.length, planLimits.maxLocations);
  const employeeQRCount = qrCodes.filter(q => q.type === 'employee').length;
  const canAddEmployeeQR= withinLimit(employeeQRCount, planLimits.maxEmployeeQRs);

  const handleAddQR = async () => {
    if (!qrForm.location_id || !qrForm.label.trim()) return;
    if (qrForm.type === 'employee' && !canAddEmployeeQR) return;
    setSaving(true);
    await supabase.from('qr_codes').insert({
      tenant_id: tenant.id, location_id: qrForm.location_id,
      type: qrForm.type, label: qrForm.label.trim(),
    });
    setQrForm({ location_id: qrForm.location_id, type: 'area', label: '' });
    setShowForm(false);
    await loadData();
    setSaving(false);
  };

  const handleAddLocation = async () => {
    if (!locForm.name.trim() || !canAddLocation) return;
    setSaving(true);
    await supabase.from('locations').insert({
      tenant_id: tenant.id, name: locForm.name.trim(),
      google_review_url: locForm.google_review_url || null,
      whatsapp_number:   locForm.whatsapp_number   || null,
    });
    setLocForm({ name: '', google_review_url: '', whatsapp_number: '' });
    setShowLocForm(false);
    await loadData();
    setSaving(false);
  };

  const handleToggleActive = async (qr) => {
    await supabase.from('qr_codes').update({ active: !qr.active }).eq('id', qr.id);
    await loadData();
  };

  const qrsByLocation = useMemo(() => {
    const map = {};
    locations.forEach(l => { map[l.id] = { location: l, qrs: [] }; });
    qrCodes.forEach(q => { if (map[q.location_id]) map[q.location_id].qrs.push(q); });
    return Object.values(map);
  }, [locations, qrCodes]);

  const toggleCollapse = (id) => setCollapsed(p => ({ ...p, [id]: !p[id] }));

  if (loading) return (
    <div style={{ padding: 28, fontFamily: font }}>
      <div style={{ height: 28, width: 160, background: '#F1F5F9', borderRadius: 8, marginBottom: 8 }} />
      <div style={{ height: 16, width: 120, background: '#F1F5F9', borderRadius: 6 }} />
    </div>
  );

  return (
    <div style={{ fontFamily: font, padding: 28, background: T.bg, minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 4 }}>
            QR Studio
          </h1>
          <p style={{ fontSize: '0.82rem', color: T.muted }}>
            {locations.length} sucursal{locations.length !== 1 ? 'es' : ''} · {qrCodes.length} QR{qrCodes.length !== 1 ? 's' : ''} · plan {planLimits.name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => canAddLocation ? setShowLocForm(v => !v) : null}
            disabled={!canAddLocation}
            style={{
              background: canAddLocation ? (showLocForm ? T.teal : '#fff') : '#F3F4F6',
              color: canAddLocation ? (showLocForm ? '#fff' : T.teal) : T.muted,
              border: `1.5px solid ${canAddLocation ? T.teal : '#E5E7EB'}`,
              borderRadius: 10, padding: '9px 16px',
              fontFamily: font, fontWeight: 700, fontSize: '0.82rem',
              cursor: canAddLocation ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <MapPin size={14} /> Nueva sucursal
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              background: showForm ? T.coral : T.coral,
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '9px 16px', fontFamily: font, fontWeight: 700, fontSize: '0.82rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 4px 12px rgba(255,92,58,0.25)',
            }}
          >
            <Plus size={14} /> Nuevo QR
          </button>
        </div>
      </div>

      {/* ── Upgrade banners ── */}
      {!canAddLocation && (
        <UpgradeBanner
          message={`Plan ${planLimits.name}: máximo ${planLimits.maxLocations} sucursal${planLimits.maxLocations > 1 ? 'es' : ''}. Mejora para agregar más.`}
        />
      )}
      {planLimits.maxEmployeeQRs === 0 && (
        <UpgradeBanner message="Los QRs de empleado están disponibles desde el plan Growth." />
      )}

      {/* ── New location form ── */}
      {showLocForm && (
        <div style={{
          background: T.card, borderRadius: 16, border: `1.5px solid ${T.teal}`,
          padding: '22px 24px', marginBottom: 20,
          boxShadow: `0 4px 20px ${T.teal}15`,
        }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: T.ink, marginBottom: 18 }}>
            Nueva sucursal
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Nombre">
              <input style={inputSt} placeholder="Sucursal Norte"
                value={locForm.name} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="URL Google Reviews">
              <input style={inputSt} placeholder="https://g.page/r/…"
                value={locForm.google_review_url} onChange={e => setLocForm(f => ({ ...f, google_review_url: e.target.value }))} />
            </Field>
            <Field label="WhatsApp manager">
              <input style={inputSt} placeholder="5215512345678"
                value={locForm.whatsapp_number} onChange={e => setLocForm(f => ({ ...f, whatsapp_number: e.target.value }))} />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={handleAddLocation} disabled={saving || !locForm.name.trim()} style={{
              background: T.teal, color: '#fff', border: 'none', borderRadius: 10,
              padding: '9px 20px', fontFamily: font, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
              opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Guardando…' : 'Crear sucursal'}</button>
            <button onClick={() => setShowLocForm(false)} style={{
              background: 'transparent', color: T.muted, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: '9px 16px', fontFamily: font, cursor: 'pointer', fontSize: '0.85rem',
            }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── New QR form ── */}
      {showForm && (
        <div style={{
          background: T.card, borderRadius: 16, border: `1.5px solid ${T.coral}`,
          padding: '22px 24px', marginBottom: 20,
          boxShadow: `0 4px 20px ${T.coral}12`,
        }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: T.ink, marginBottom: 18 }}>
            Nuevo QR
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12 }}>
            <Field label="Sucursal">
              <select style={inputSt} value={qrForm.location_id}
                onChange={e => setQrForm(f => ({ ...f, location_id: e.target.value }))}>
                <option value="">Selecciona…</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Tipo">
              <select style={inputSt} value={qrForm.type}
                onChange={e => setQrForm(f => ({ ...f, type: e.target.value }))}>
                {QR_TYPES.map(t => (
                  <option key={t.value} value={t.value}
                    disabled={t.value === 'employee' && !canAddEmployeeQR}>
                    {t.label}{t.value === 'employee' && !canAddEmployeeQR ? ' 🔒' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Etiqueta">
              <input style={inputSt} placeholder="ej: Mesa 1, Juan López, Turno Mañana"
                value={qrForm.label} onChange={e => setQrForm(f => ({ ...f, label: e.target.value }))} />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={handleAddQR}
              disabled={saving || !qrForm.location_id || !qrForm.label.trim()}
              style={{
                background: T.coral, color: '#fff', border: 'none', borderRadius: 10,
                padding: '9px 20px', fontFamily: font, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                opacity: (saving || !qrForm.location_id || !qrForm.label.trim()) ? 0.5 : 1,
                boxShadow: '0 4px 12px rgba(255,92,58,0.25)',
              }}>{saving ? 'Guardando…' : 'Crear QR'}</button>
            <button onClick={() => setShowForm(false)} style={{
              background: 'transparent', color: T.muted, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: '9px 16px', fontFamily: font, cursor: 'pointer', fontSize: '0.85rem',
            }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {locations.length === 0 ? (
        <div style={{
          background: T.card, borderRadius: 20, border: `1px solid ${T.border}`,
          padding: '56px 24px', textAlign: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, background: T.teal + '15',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <MapPin size={28} color={T.teal} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: T.ink, marginBottom: 8 }}>
            Crea tu primera sucursal
          </h3>
          <p style={{ fontSize: '0.85rem', color: T.muted, marginBottom: 24, maxWidth: 320, margin: '0 auto 24px' }}>
            Después podrás generar QRs para cada área, empleado o turno dentro de ella.
          </p>
          <button onClick={() => setShowLocForm(true)} style={{
            background: T.teal, color: '#fff', border: 'none', borderRadius: 10,
            padding: '11px 24px', fontFamily: font, fontWeight: 700, cursor: 'pointer',
            fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Plus size={15} /> Nueva sucursal
          </button>
        </div>
      ) : (
        qrsByLocation.map(({ location, qrs }) => {
          const isCollapsed = collapsed[location.id];
          return (
            <div key={location.id} style={{
              background: T.card, borderRadius: 20,
              border: `1px solid ${T.border}`, marginBottom: 20, overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              {/* Location header */}
              <div
                onClick={() => toggleCollapse(location.id)}
                style={{
                  padding: '16px 22px', borderBottom: isCollapsed ? 'none' : `1px solid ${T.border}`,
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                  background: isCollapsed ? '#FAFAFA' : T.card,
                }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: T.teal + '15',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin size={16} color={T.teal} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 800, color: T.ink, fontSize: '0.95rem' }}>{location.name}</span>
                  <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 2 }}>
                    {qrs.length} QR{qrs.length !== 1 ? 's' : ''} · {qrs.filter(q => q.active).length} activos
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setQrForm(f => ({ ...f, location_id: location.id })); setShowForm(true); }}
                  style={{
                    background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8,
                    padding: '5px 12px', fontFamily: font, fontSize: '0.72rem', fontWeight: 700,
                    color: T.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                  <Plus size={12} /> QR
                </button>
                {isCollapsed ? <ChevronDown size={16} color={T.muted} /> : <ChevronUp size={16} color={T.muted} />}
              </div>

              {/* QR grid */}
              {!isCollapsed && (
                qrs.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center' }}>
                    <QrCode size={32} color="#E5E7EB" style={{ marginBottom: 10 }} />
                    <p style={{ fontSize: '0.85rem', color: T.muted, fontWeight: 500 }}>
                      Sin QRs aún. Haz clic en "+ QR" para crear uno.
                    </p>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                    gap: 16, padding: '20px 22px',
                  }}>
                    {qrs.map(qr => (
                      <QRCard key={qr.id} qr={qr} location={location} onToggle={handleToggleActive} />
                    ))}
                  </div>
                )
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
