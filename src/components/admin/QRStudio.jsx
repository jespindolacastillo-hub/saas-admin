import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { getPlanLimits, withinLimit } from '../../config/planLimits';
import {
  Plus, Download, Printer, Zap, MapPin, Lock, QrCode,
  Copy, Check, Pause, Play, ChevronRight, X, Search,
  MoreVertical, Eye,
} from 'lucide-react';

const T = {
  coral:  '#FF5C3A', teal:  '#00C9A7', purple: '#7C3AED',
  ink:    '#0D0D12', muted: '#6B7280', border: '#E5E7EB',
  bg:     '#F7F8FC', card:  '#FFFFFF', green:  '#16A34A',
  amber:  '#F59E0B', red:   '#EF4444',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const QR_TYPES = [
  { value: 'area',     label: 'Área / Mesa',  color: T.teal   },
  { value: 'employee', label: 'Empleado',      color: T.purple },
  { value: 'shift',    label: 'Turno',         color: T.coral  },
  { value: 'product',  label: 'Producto',      color: '#F59E0B'},
  { value: 'event',    label: 'Evento',        color: '#EC4899'},
  { value: 'channel',  label: 'Canal',         color: '#06B6D4'},
];
const getTypeInfo = val => QR_TYPES.find(t => t.value === val) || QR_TYPES[0];

// ─── Utils ────────────────────────────────────────────────────────────────────
function locationHealthColor(qrs) {
  if (!qrs.length) return T.muted;
  const active = qrs.filter(q => q.active).length;
  if (active === qrs.length) return T.green;
  if (active > 0) return T.amber;
  return T.red;
}

function downloadQR(id, label) {
  const svg = document.getElementById(id);
  if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 400;
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
      body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;
           font-family:'Plus Jakarta Sans',sans-serif;flex-direction:column;background:#fff;}
      .loc{font-size:1rem;font-weight:800;color:#0D0D12;margin-bottom:4px;}
      .lbl{font-size:0.85rem;color:#6B7280;font-weight:600;margin-bottom:20px;}
      .brand{font-size:0.65rem;color:#D1D5DB;margin-top:14px;font-weight:600;}
    </style></head><body>
    <div class="loc">${locationName||''}</div>
    <div class="lbl">${label}</div>
    <div id="qr"></div>
    <div class="brand">retelio.com.mx</div>
    <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
    <script>QRCode.toCanvas(document.createElement('canvas'),'${url}',{width:260,margin:2},function(e,c){document.getElementById('qr').appendChild(c);window.print();});</script>
    </body></html>`);
  win.document.close();
}

function printAll(qrs, locationName, testMode) {
  const testSuffix = testMode ? '?test=1' : '';
  const items = qrs.filter(q => q.active).map(q => ({
    url: `${window.location.origin}/f/${q.id}${testSuffix}`, label: q.label, type: q.type,
  }));
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>QRs - ${locationName}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap');
      body{font-family:'Plus Jakarta Sans',sans-serif;margin:20px;background:#fff;}
      h2{font-size:1.1rem;font-weight:800;color:#0D0D12;margin-bottom:20px;}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;}
      .item{text-align:center;border:1px solid #E5E7EB;border-radius:12px;padding:16px;}
      .lbl{font-size:0.78rem;font-weight:700;color:#0D0D12;margin-top:8px;}
      .brand{font-size:0.55rem;color:#D1D5DB;margin-top:4px;}
      @media print{body{margin:10px}}
    </style></head><body>
    <h2>${locationName}</h2>
    <div class="grid" id="grid"></div>
    <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
    <script>
      var items=${JSON.stringify(items)};
      var g=document.getElementById('grid');
      var done=0;
      items.forEach(function(item){
        var div=document.createElement('div');div.className='item';
        var c=document.createElement('canvas');
        QRCode.toCanvas(c,item.url,{width:120,margin:1},function(){
          div.appendChild(c);
          div.innerHTML+='<div class="lbl">'+item.label+'</div><div class="brand">retelio.com.mx</div>';
          g.appendChild(div);
          if(++done===items.length)window.print();
        });
      });
    </script></body></html>`);
  win.document.close();
}

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyBtn({ text, label = 'Copiar URL' }) {
  const [done, setDone] = useState(false);
  const handle = () => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); };
  return (
    <button onClick={handle} style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
      borderRadius: 8, border: `1px solid ${done ? T.teal + '40' : T.border}`,
      background: done ? T.teal + '10' : '#fff', cursor: 'pointer',
      fontFamily: font, fontSize: '0.78rem', fontWeight: 600,
      color: done ? T.teal : T.muted, transition: 'all 0.2s',
    }}>
      {done ? <Check size={13} /> : <Copy size={13} />}
      {done ? 'Copiado' : label}
    </button>
  );
}

// ─── QR Drawer ────────────────────────────────────────────────────────────────
function QRDrawer({ qr, location, onClose, onToggle, testMode }) {
  if (!qr) return null;
  const testSuffix = testMode ? '?test=1' : '';
  const url      = `${window.location.origin}/f/${qr.id}${testSuffix}`;
  const svgId    = `drawer-qr-${qr.id}`;
  const typeInfo = getTypeInfo(qr.type);

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)',
        zIndex: 200, backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 380,
        background: T.card, zIndex: 201,
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', fontFamily: font,
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: T.ink }}>{qr.label}</div>
            <div style={{ fontSize: '0.75rem', color: T.muted, marginTop: 2 }}>{location?.name}</div>
          </div>
          <button onClick={onClose} style={{
            background: '#F1F5F9', border: 'none', borderRadius: 8,
            width: 32, height: 32, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer',
          }}>
            <X size={15} color={T.muted} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          {/* QR code */}
          <div style={{
            display: 'flex', justifyContent: 'center', marginBottom: 24,
          }}>
            <div style={{
              padding: 20, background: '#fff', borderRadius: 20,
              border: `1px solid ${T.border}`,
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
              opacity: qr.active ? 1 : 0.45,
            }}>
              <QRCodeSVG id={svgId} value={url} size={200} level="M" />
            </div>
          </div>

          {/* Type + scans */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
            <span style={{
              fontSize: '0.78rem', fontWeight: 700,
              background: typeInfo.color + '15', color: typeInfo.color,
              borderRadius: 999, padding: '4px 12px',
            }}>{typeInfo.label}</span>
            <span style={{ fontSize: '0.78rem', color: T.muted, fontWeight: 500 }}>
              {qr.scan_count || 0} scans
            </span>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700,
              color: qr.active ? T.green : T.muted,
              background: qr.active ? T.green + '12' : '#F1F5F9',
              borderRadius: 999, padding: '3px 10px',
            }}>
              {qr.active ? '● Activo' : '⏸ Pausado'}
            </span>
          </div>

          {/* URL */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>URL del QR</div>
            <div style={{
              background: '#F8F9FC', borderRadius: 10, padding: '10px 12px',
              fontSize: '0.75rem', color: T.muted, wordBreak: 'break-all',
              border: `1px solid ${T.border}`, fontFamily: 'monospace',
            }}>{url}</div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => downloadQR(svgId, qr.label)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px', borderRadius: 10, border: `1px solid ${T.border}`,
                background: '#fff', cursor: 'pointer', fontFamily: font,
                fontWeight: 600, fontSize: '0.82rem', color: T.ink,
              }}>
                <Download size={14} /> Descargar PNG
              </button>
              <button onClick={() => printQR(url, qr.label, location?.name)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px', borderRadius: 10, border: `1px solid ${T.border}`,
                background: '#fff', cursor: 'pointer', fontFamily: font,
                fontWeight: 600, fontSize: '0.82rem', color: T.ink,
              }}>
                <Printer size={14} /> Imprimir
              </button>
            </div>
            <CopyBtn text={url} label="Copiar URL del QR" />
            <button onClick={() => onToggle(qr)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px', borderRadius: 10, border: `1px solid ${qr.active ? '#FECACA' : '#BBF7D0'}`,
              background: qr.active ? '#FEF2F2' : '#F0FDF4',
              cursor: 'pointer', fontFamily: font,
              fontWeight: 700, fontSize: '0.82rem',
              color: qr.active ? T.coral : T.green,
            }}>
              {qr.active ? <><Pause size={14} /> Pausar QR</> : <><Play size={14} /> Activar QR</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Modal Form ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)',
        zIndex: 300, backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        background: T.card, borderRadius: 20, padding: 28,
        width: 480, zIndex: 301, fontFamily: font,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontWeight: 800, fontSize: '1rem', color: T.ink }}>{title}</h3>
          <button onClick={onClose} style={{
            background: '#F1F5F9', border: 'none', borderRadius: 8,
            width: 30, height: 30, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer',
          }}>
            <X size={14} color={T.muted} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

const inputSt = {
  width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10,
  padding: '10px 12px', fontFamily: font, fontSize: '0.88rem', outline: 'none',
  boxSizing: 'border-box', background: '#fff', color: T.ink,
};

function FieldRow({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: T.muted,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function QRStudio() {
  const { tenant } = useTenant();
  const [locations,    setLocations]    = useState([]);
  const [qrCodes,      setQrCodes]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedLoc,  setSelectedLoc]  = useState(null);
  const [selectedQR,   setSelectedQR]   = useState(null);
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [locSearch,    setLocSearch]    = useState('');
  const [showQRModal,  setShowQRModal]  = useState(false);
  const [showLocModal, setShowLocModal] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [qrForm,  setQrForm]  = useState({ location_id: '', type: 'area', label: '' });
  const [locForm, setLocForm] = useState({ name: '', google_review_url: '', whatsapp_number: '' });

  const planLimits       = getPlanLimits(tenant?.plan);
  const canAddLocation   = withinLimit(locations.length, planLimits.maxLocations);
  const employeeQRCount  = qrCodes.filter(q => q.type === 'employee').length;
  const canAddEmployeeQR = withinLimit(employeeQRCount, planLimits.maxEmployeeQRs);

  useEffect(() => { if (tenant?.id) loadData(); }, [tenant?.id]);

  const loadData = async () => {
    setLoading(true);
    const [locRes, qrRes] = await Promise.all([
      supabase.from('locations').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('qr_codes').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
    ]);
    if (locRes.data) {
      setLocations(locRes.data);
      if (!selectedLoc && locRes.data.length > 0) setSelectedLoc(locRes.data[0].id);
    }
    if (qrRes.data) setQrCodes(qrRes.data);
    setLoading(false);
  };

  const handleAddQR = async () => {
    const locId = qrForm.location_id || selectedLoc;
    if (!locId || !qrForm.label.trim()) return;
    if (qrForm.type === 'employee' && !canAddEmployeeQR) return;
    setSaving(true);
    await supabase.from('qr_codes').insert({
      tenant_id: tenant.id, location_id: locId,
      type: qrForm.type, label: qrForm.label.trim(),
    });
    setQrForm({ location_id: '', type: 'area', label: '' });
    setShowQRModal(false);
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
    setShowLocModal(false);
    await loadData();
    setSaving(false);
  };

  const handleToggleActive = async (qr) => {
    const updated = { ...qr, active: !qr.active };
    setQrCodes(prev => prev.map(q => q.id === qr.id ? updated : q));
    if (selectedQR?.id === qr.id) setSelectedQR(updated);
    await supabase.from('qr_codes').update({ active: !qr.active }).eq('id', qr.id);
  };

  // Derived data
  const qrsByLoc = useMemo(() => {
    const map = {};
    locations.forEach(l => { map[l.id] = []; });
    qrCodes.forEach(q => { if (map[q.location_id]) map[q.location_id].push(q); });
    return map;
  }, [locations, qrCodes]);

  const filteredLocations = useMemo(() =>
    locations.filter(l => l.name.toLowerCase().includes(locSearch.toLowerCase())),
  [locations, locSearch]);

  const currentLocation = locations.find(l => l.id === selectedLoc);
  const currentQRs      = qrsByLoc[selectedLoc] || [];
  const availableTypes  = [...new Set(currentQRs.map(q => q.type))];
  const visibleQRs      = typeFilter === 'all' ? currentQRs : currentQRs.filter(q => q.type === typeFilter);

  if (loading) return (
    <div style={{ padding: 28, fontFamily: font }}>
      <div style={{ height: 28, width: 160, background: '#F1F5F9', borderRadius: 8, marginBottom: 8 }} />
    </div>
  );

  return (
    <div style={{ fontFamily: font, background: T.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ── */}
      <div style={{
        padding: '20px 28px', background: T.card, borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 2 }}>
            QR Studio
          </h1>
          <p style={{ fontSize: '0.78rem', color: T.muted }}>
            {locations.length} sucursal{locations.length !== 1 ? 'es' : ''} · {qrCodes.length} QRs · plan {planLimits.name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => canAddLocation ? setShowLocModal(true) : null} disabled={!canAddLocation} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 10,
            border: `1.5px solid ${canAddLocation ? T.teal : T.border}`,
            background: '#fff', color: canAddLocation ? T.teal : T.muted,
            fontFamily: font, fontWeight: 700, fontSize: '0.82rem',
            cursor: canAddLocation ? 'pointer' : 'not-allowed',
          }}>
            <MapPin size={14} /> Nueva sucursal
          </button>
          <button onClick={() => setShowQRModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 10, border: 'none',
            background: T.coral, color: '#fff',
            fontFamily: font, fontWeight: 700, fontSize: '0.82rem',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,92,58,0.25)',
          }}>
            <Plus size={14} /> Nuevo QR
          </button>
        </div>
      </div>

      {/* ── Two-panel layout ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* ── Left sidebar: locations ── */}
        <div style={{
          width: 256, flexShrink: 0, background: T.card,
          borderRight: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#F8F9FC', borderRadius: 10, padding: '8px 12px',
              border: `1px solid ${T.border}`,
            }}>
              <Search size={13} color={T.muted} />
              <input
                value={locSearch}
                onChange={e => setLocSearch(e.target.value)}
                placeholder="Buscar sucursal…"
                style={{ border: 'none', outline: 'none', background: 'transparent',
                  fontFamily: font, fontSize: '0.82rem', color: T.ink, width: '100%' }}
              />
            </div>
          </div>

          {/* Location list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredLocations.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: T.muted, fontSize: '0.82rem' }}>
                Sin resultados
              </div>
            ) : filteredLocations.map(loc => {
              const qrs      = qrsByLoc[loc.id] || [];
              const dotColor = locationHealthColor(qrs);
              const isActive = selectedLoc === loc.id;
              return (
                <div key={loc.id} onClick={() => { setSelectedLoc(loc.id); setTypeFilter('all'); }} style={{
                  padding: '12px 16px', cursor: 'pointer',
                  background: isActive ? T.coral + '08' : 'transparent',
                  borderLeft: `3px solid ${isActive ? T.coral : 'transparent'}`,
                  borderBottom: `1px solid ${T.border}`,
                  transition: 'all 0.12s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: dotColor, flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: '0.83rem', fontWeight: isActive ? 700 : 500,
                      color: isActive ? T.coral : T.ink,
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{loc.name}</span>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 600, color: T.muted,
                      background: '#F1F5F9', borderRadius: 999, padding: '2px 7px', flexShrink: 0,
                    }}>{qrs.length}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right panel: QR table ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {locations.length === 0 ? (
            // Empty state
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: T.teal + '15',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <MapPin size={28} color={T.teal} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: T.ink, marginBottom: 8 }}>Crea tu primera sucursal</h3>
              <p style={{ fontSize: '0.85rem', color: T.muted, marginBottom: 24, textAlign: 'center', maxWidth: 300 }}>
                Luego podrás generar QRs para cada área, empleado o turno.
              </p>
              <button onClick={() => setShowLocModal(true)} style={{
                background: T.teal, color: '#fff', border: 'none', borderRadius: 10,
                padding: '10px 22px', fontFamily: font, fontWeight: 700, fontSize: '0.88rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Plus size={15} /> Nueva sucursal
              </button>
            </div>
          ) : (
            <>
              {/* Panel header */}
              <div style={{
                padding: '16px 24px', background: T.card,
                borderBottom: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: T.ink }}>
                    {currentLocation?.name || '—'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 1 }}>
                    {currentQRs.length} QRs · {currentQRs.filter(q => q.active).length} activos
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {currentQRs.length > 0 && (
                    <button onClick={() => printAll(currentQRs, currentLocation?.name, tenant?.test_mode)} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 9,
                      border: `1px solid ${T.border}`, background: '#fff',
                      fontFamily: font, fontWeight: 600, fontSize: '0.78rem',
                      color: T.muted, cursor: 'pointer',
                    }}>
                      <Printer size={13} /> Imprimir todos
                    </button>
                  )}
                  <button onClick={() => { setQrForm(f => ({ ...f, location_id: selectedLoc })); setShowQRModal(true); }} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 14px', borderRadius: 9, border: 'none',
                    background: T.coral, color: '#fff',
                    fontFamily: font, fontWeight: 700, fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}>
                    <Plus size={13} /> Nuevo QR
                  </button>
                </div>
              </div>

              {/* Type filter tabs */}
              {availableTypes.length > 1 && (
                <div style={{
                  padding: '10px 24px', background: T.card,
                  borderBottom: `1px solid ${T.border}`,
                  display: 'flex', gap: 6, flexShrink: 0,
                }}>
                  {['all', ...availableTypes].map(type => {
                    const info    = type === 'all' ? null : getTypeInfo(type);
                    const isActive = typeFilter === type;
                    return (
                      <button key={type} onClick={() => setTypeFilter(type)} style={{
                        padding: '5px 14px', borderRadius: 999,
                        border: `1.5px solid ${isActive ? (info?.color || T.ink) : T.border}`,
                        background: isActive ? (info?.color || T.ink) + (info ? '12' : '') : '#fff',
                        color: isActive ? (info?.color || T.ink) : T.muted,
                        fontFamily: font, fontWeight: 600, fontSize: '0.78rem',
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}>
                        {type === 'all' ? 'Todos' : info?.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* QR table */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {visibleQRs.length === 0 ? (
                  <div style={{ padding: 48, textAlign: 'center' }}>
                    <QrCode size={32} color="#E5E7EB" style={{ marginBottom: 10 }} />
                    <p style={{ color: T.muted, fontSize: '0.85rem', fontWeight: 500 }}>
                      Sin QRs. Haz clic en "+ Nuevo QR" para crear uno.
                    </p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr style={{ background: '#FAFAFA' }}>
                        {['Tipo', 'Nombre', 'Scans', 'Estado', ''].map(h => (
                          <th key={h} style={{
                            padding: '10px 16px', textAlign: 'left',
                            fontWeight: 700, color: T.muted,
                            fontSize: '0.68rem', textTransform: 'uppercase',
                            letterSpacing: '0.07em', borderBottom: `1px solid ${T.border}`,
                            whiteSpace: 'nowrap',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleQRs.map((qr, idx) => {
                        const typeInfo = getTypeInfo(qr.type);
                        return (
                          <tr key={qr.id} style={{
                            borderBottom: `1px solid ${T.border}`,
                            background: idx % 2 === 0 ? '#fff' : '#FAFAFA',
                            opacity: qr.active ? 1 : 0.55,
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = T.coral + '05'}
                          onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFAFA'}
                          >
                            {/* Type */}
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                fontSize: '0.72rem', fontWeight: 700,
                                background: typeInfo.color + '15', color: typeInfo.color,
                                borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap',
                              }}>{typeInfo.label}</span>
                            </td>
                            {/* Label */}
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: T.ink }}>
                              {qr.label}
                            </td>
                            {/* Scans */}
                            <td style={{ padding: '12px 16px', color: T.muted, fontWeight: 500 }}>
                              {qr.scan_count || 0}
                            </td>
                            {/* Status */}
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                fontSize: '0.72rem', fontWeight: 700,
                                color: qr.active ? T.green : T.muted,
                                background: qr.active ? T.green + '12' : '#F1F5F9',
                                borderRadius: 999, padding: '3px 10px',
                              }}>
                                {qr.active ? '● Activo' : '⏸ Pausado'}
                              </span>
                            </td>
                            {/* Actions */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button onClick={() => setSelectedQR(qr)} style={{
                                  display: 'flex', alignItems: 'center', gap: 5,
                                  padding: '6px 12px', borderRadius: 8,
                                  border: `1px solid ${T.border}`, background: '#fff',
                                  cursor: 'pointer', fontFamily: font,
                                  fontWeight: 600, fontSize: '0.75rem', color: T.ink,
                                }}>
                                  <Eye size={13} /> Ver QR
                                </button>
                                <button onClick={() => handleToggleActive(qr)} style={{
                                  display: 'flex', alignItems: 'center', gap: 5,
                                  padding: '6px 12px', borderRadius: 8,
                                  border: `1px solid ${qr.active ? '#FECACA' : '#BBF7D0'}`,
                                  background: qr.active ? '#FEF2F2' : '#F0FDF4',
                                  cursor: 'pointer', fontFamily: font,
                                  fontWeight: 700, fontSize: '0.75rem',
                                  color: qr.active ? T.coral : T.green,
                                }}>
                                  {qr.active ? <Pause size={12} /> : <Play size={12} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── QR Drawer ── */}
      <QRDrawer
        qr={selectedQR}
        location={currentLocation}
        onClose={() => setSelectedQR(null)}
        onToggle={handleToggleActive}
        testMode={tenant?.test_mode}
      />

      {/* ── New QR Modal ── */}
      {showQRModal && (
        <Modal title="Nuevo QR" onClose={() => setShowQRModal(false)}>
          <FieldRow label="Sucursal">
            <select style={inputSt} value={qrForm.location_id || selectedLoc}
              onChange={e => setQrForm(f => ({ ...f, location_id: e.target.value }))}>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Tipo">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {QR_TYPES.map(t => {
                const locked = t.value === 'employee' && !canAddEmployeeQR;
                const active = qrForm.type === t.value;
                return (
                  <button key={t.value} onClick={() => !locked && setQrForm(f => ({ ...f, type: t.value }))} style={{
                    padding: '9px 8px', borderRadius: 10, textAlign: 'center',
                    border: `2px solid ${active ? t.color : T.border}`,
                    background: active ? t.color + '10' : '#fff',
                    cursor: locked ? 'not-allowed' : 'pointer',
                    fontFamily: font, opacity: locked ? 0.4 : 1,
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: active ? t.color : T.ink }}>{t.label}</div>
                    {locked && <div style={{ fontSize: '0.62rem', color: T.muted }}>🔒 Plan</div>}
                  </button>
                );
              })}
            </div>
          </FieldRow>
          <FieldRow label="Etiqueta">
            <input style={inputSt} placeholder="ej: Mesa 1, Juan López, Turno Mañana"
              value={qrForm.label} onChange={e => setQrForm(f => ({ ...f, label: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAddQR()} autoFocus />
          </FieldRow>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={handleAddQR}
              disabled={saving || !qrForm.label.trim()}
              style={{
                flex: 1, background: saving || !qrForm.label.trim() ? T.muted : T.coral,
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '11px', fontFamily: font, fontWeight: 700, fontSize: '0.88rem',
                cursor: saving || !qrForm.label.trim() ? 'not-allowed' : 'pointer',
              }}>{saving ? 'Creando…' : 'Crear QR'}</button>
            <button onClick={() => setShowQRModal(false)} style={{
              padding: '11px 18px', borderRadius: 10, border: `1px solid ${T.border}`,
              background: '#fff', color: T.muted, cursor: 'pointer', fontFamily: font, fontWeight: 600,
            }}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* ── New Location Modal ── */}
      {showLocModal && (
        <Modal title="Nueva sucursal" onClose={() => setShowLocModal(false)}>
          <FieldRow label="Nombre">
            <input style={inputSt} placeholder="Sucursal Norte"
              value={locForm.name} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))}
              autoFocus />
          </FieldRow>
          <FieldRow label="URL Google Reviews">
            <input style={inputSt} placeholder="https://g.page/r/…"
              value={locForm.google_review_url} onChange={e => setLocForm(f => ({ ...f, google_review_url: e.target.value }))} />
          </FieldRow>
          <FieldRow label="WhatsApp manager">
            <input style={inputSt} placeholder="5215512345678"
              value={locForm.whatsapp_number} onChange={e => setLocForm(f => ({ ...f, whatsapp_number: e.target.value }))} />
          </FieldRow>
          {!canAddLocation && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
              background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, marginBottom: 12,
            }}>
              <Lock size={14} color={T.coral} />
              <span style={{ fontSize: '0.78rem', color: '#92400E', fontWeight: 600 }}>
                Límite de {planLimits.maxLocations} sucursal{planLimits.maxLocations > 1 ? 'es' : ''} en tu plan
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAddLocation}
              disabled={saving || !locForm.name.trim() || !canAddLocation}
              style={{
                flex: 1, background: !locForm.name.trim() || !canAddLocation ? T.muted : T.teal,
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '11px', fontFamily: font, fontWeight: 700, fontSize: '0.88rem',
                cursor: !locForm.name.trim() || !canAddLocation ? 'not-allowed' : 'pointer',
              }}>{saving ? 'Creando…' : 'Crear sucursal'}</button>
            <button onClick={() => setShowLocModal(false)} style={{
              padding: '11px 18px', borderRadius: 10, border: `1px solid ${T.border}`,
              background: '#fff', color: T.muted, cursor: 'pointer', fontFamily: font, fontWeight: 600,
            }}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
