import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import { getPlanLimits, withinLimit } from '../../config/planLimits';
import {
  Plus, Download, Printer, Zap, MapPin, Lock, QrCode,
  Copy, Check, Pause, Play, ChevronRight, X, Search,
  MoreVertical, Eye, Edit2, Trash2, Loader,
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
function QRDrawer({ qr, location, onClose, onToggle, testMode, couponConfigs = [], areas = [] }) {
  if (!qr) return null;
  const testSuffix = testMode ? '?test=1' : '';
  const url      = `${window.location.origin}/f/${qr.id}${testSuffix}`;
  const svgId    = `drawer-qr-${qr.id}`;
  const typeInfo = getTypeInfo(qr.type);
  const assignedArea   = qr.area_id ? areas.find(a => a.id === qr.area_id) : null;
  const assignedCoupon = qr.coupon_config_id
    ? couponConfigs.find(c => c.id === qr.coupon_config_id)
    : assignedArea?.coupon_config_id
      ? couponConfigs.find(c => c.id === assignedArea.coupon_config_id)
      : null;
  const couponIsInherited = !qr.coupon_config_id && !!assignedCoupon;

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

          {/* Area badge */}
          {assignedArea && (
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, background: T.teal+'15', color: T.teal, borderRadius: 999, padding: '3px 10px' }}>
                📍 {assignedArea.nombre}
              </span>
            </div>
          )}

          {/* Assigned coupon */}
          {assignedCoupon && (
            <div style={{ marginBottom: 20, background: T.purple + '08', border: `1px solid ${T.purple}25`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: T.purple, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                🎟 Cupón {couponIsInherited ? `heredado de ${assignedArea?.nombre}` : 'asignado'}
              </div>
              <div style={{ fontWeight: 700, color: T.ink, fontSize: '0.88rem' }}>{assignedCoupon.name}</div>
              <div style={{ fontSize: '0.75rem', color: T.muted, marginTop: 2 }}>{assignedCoupon.offer_description}</div>
            </div>
          )}
          {!assignedCoupon && (
            <div style={{ marginBottom: 20, background: T.bg, borderRadius: 10, padding: '8px 12px', fontSize: '0.72rem', color: T.muted, border: `1px solid ${T.border}` }}>
              🎟 Sin cupón específico — usa configuración global
            </div>
          )}

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
function Modal({ title, onClose, children, width = 480 }) {
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
        width, maxHeight: '90vh', overflowY: 'auto', zIndex: 301, fontFamily: font,
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

function GoogleReviewTutorial() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.75rem', color: T.teal, fontWeight: 700, fontFamily: font,
          padding: 0,
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>{open ? '▾' : '▸'}</span>
        ¿Cómo obtengo mi URL de Google Reviews?
      </button>

      {open && (
        <div style={{
          marginTop: 10, background: '#F0FDF9', border: '1px solid #99F6E4',
          borderRadius: 12, padding: '14px 16px',
        }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#065F46', marginBottom: 12 }}>
            📋 Tutorial — 3 pasos rápidos
          </div>
          {[
            {
              n: 1,
              title: 'Entra a Google Business Profile',
              desc: 'Ve a',
              link: 'https://business.google.com',
              linkText: 'business.google.com',
              extra: 'e inicia sesión con la cuenta de Google de tu negocio.',
            },
            {
              n: 2,
              title: 'Abre tu negocio y ve a "Pedir reseñas"',
              desc: 'En el panel de tu negocio, busca el botón',
              bold: '"Pedir reseñas"',
              extra: 'o ve a Inicio → sección Obtener más reseñas. Google te mostrará un enlace directo.',
            },
            {
              n: 3,
              title: 'Copia el enlace y pégalo aquí',
              desc: 'El enlace tiene el formato',
              bold: 'https://g.page/r/XXXXX/review',
              extra: 'Cópialo y pégalo en el campo de arriba.',
            },
          ].map(step => (
            <div key={step.n} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: T.teal,
                color: '#fff', fontSize: '0.7rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
              }}>{step.n}</div>
              <div style={{ fontSize: '0.76rem', color: '#065F46', lineHeight: 1.5 }}>
                <strong>{step.title}</strong><br />
                {step.desc}{' '}
                {step.link && (
                  <a href={step.link} target="_blank" rel="noopener noreferrer"
                    style={{ color: T.teal, fontWeight: 700 }}>{step.linkText}</a>
                )}
                {step.bold && <strong> {step.bold}</strong>}
                {' '}{step.extra}
              </div>
            </div>
          ))}
          <div style={{
            marginTop: 4, padding: '8px 12px', background: '#CCFBF1',
            borderRadius: 8, fontSize: '0.72rem', color: '#047857', fontWeight: 600,
          }}>
            💡 Tip: Si tu negocio aún no aparece en Google, primero debes verificarlo en{' '}
            <a href="https://business.google.com" target="_blank" rel="noopener noreferrer"
              style={{ color: '#065F46', fontWeight: 800 }}>Google Business Profile</a>.
            El proceso tarda ~1 semana por correo postal.
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Main ─────────────────────────────────────────────────────────────────────
export default function QRStudio() {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [locations,    setLocations]    = useState([]);
  const [qrCodes,      setQrCodes]      = useState([]);
  const [couponConfigs, setCouponConfigs] = useState([]);
  const [areas,         setAreas]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedLoc,  setSelectedLoc]  = useState(null);
  const [selectedQR,   setSelectedQR]   = useState(null);
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [locSearch,    setLocSearch]    = useState('');
  const [showQRModal,  setShowQRModal]  = useState(false);
  const [showLocModal, setShowLocModal] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [rightTab,     setRightTab]     = useState('qrs'); // 'areas' | 'qrs'
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [editingArea,   setEditingArea]   = useState(null); // null = new, obj = editing
  const [areaForm,      setAreaForm]      = useState({ nombre: '', coupon_config_id: '' });
  const [qrForm,         setQrForm]         = useState({ location_id: '', type: 'area', label: '', area_id: '', coupon_config_id: '' });
  const [showEditQRModal, setShowEditQRModal] = useState(false);
  const [editingQR,       setEditingQR]       = useState(null);
  const [editQRForm,      setEditQRForm]      = useState({ label: '', type: 'area', area_id: '', coupon_config_id: '' });
  const [locForm,        setLocForm]        = useState({ name: '', cp: '', calle: '', colonia: '', municipio: '', estado: '', google_review_url: '', whatsapp_number: '' });
  const [cpStatus,       setCpStatus]       = useState('idle'); // idle | loading | found | error
  const [coloniaOptions, setColoniaOptions] = useState([]);
  const [editingLoc,     setEditingLoc]     = useState(null);
  const [locMenuOpen,    setLocMenuOpen]    = useState(null);
  const [isCustomColonia, setIsCustomColonia] = useState(false);

  const planLimits       = getPlanLimits(tenant?.plan);
  const canAddLocation   = withinLimit(locations.length, planLimits.maxLocations);
  const employeeQRCount  = qrCodes.filter(q => q.type === 'employee').length;
  const canAddEmployeeQR = withinLimit(employeeQRCount, planLimits.maxEmployeeQRs);

  useEffect(() => { if (tenant?.id) loadData(); }, [tenant?.id]);

  const loadData = async () => {
    setLoading(true);
    const [locRes, qrRes, cpRes, areaRes] = await Promise.all([
      supabase.from('locations').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('qr_codes').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('coupon_configs').select('id,name,offer_description,coupon_prefix,trigger_type,enabled').eq('tenant_id', tenant.id).eq('enabled', true),
      supabase.from('Areas_Catalogo').select('id,nombre,coupon_config_id,location_id').eq('tenant_id', tenant.id).order('orden'),
    ]);
    if (locRes.data) {
      setLocations(locRes.data);
      if (!selectedLoc && locRes.data.length > 0) setSelectedLoc(locRes.data[0].id);
    }
    if (qrRes.data) setQrCodes(qrRes.data);
    if (cpRes.data) setCouponConfigs(cpRes.data);
    if (areaRes.data) setAreas(areaRes.data);
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
      area_id: qrForm.area_id || null,
      coupon_config_id: qrForm.coupon_config_id || null,
    });
    setQrForm({ location_id: '', type: 'area', label: '', area_id: '', coupon_config_id: '' });
    setShowQRModal(false);
    await loadData();
    setSaving(false);
  };

  const lookupCP = async (cp) => {
    if (cp.length !== 5) return;
    setCpStatus('loading');
    setColoniaOptions([]);
    try {
      const { data, error } = await supabase
        .from('codigos_postales')
        .select('colonias, municipio, estado')
        .eq('cp', cp)
        .maybeSingle();
      if (!error && data) {
        setColoniaOptions(data.colonias || []);
        setLocForm(f => ({
          ...f,
          municipio: data.municipio,
          estado: data.estado,
          colonia: data.colonias?.length === 1 ? data.colonias[0] : '',
        }));
        setCpStatus('found');
      } else {
        setCpStatus('error');
      }
    } catch {
      setCpStatus('error');
    }
  };

  const handleAddLocation = async () => {
    if (!locForm.name.trim()) return;
    setSaving(true);
    const payload = {
      name:              locForm.name.trim(),
      cp:                locForm.cp        || null,
      calle:             locForm.calle     || null,
      colonia:           locForm.colonia   || null,
      municipio:         locForm.municipio || null,
      estado:            locForm.estado    || null,
      google_review_url: locForm.google_review_url || null,
      whatsapp_number:   locForm.whatsapp_number   || null,
    };

    // Auto-geocoding con Nominatim (OSM)
    const geocodeQuery = [locForm.calle, locForm.colonia, locForm.municipio, locForm.estado, 'México']
      .filter(Boolean).join(', ');
    if (geocodeQuery.replace(/,\s*/g, '').trim()) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geocodeQuery)}&format=json&limit=1`,
          { headers: { 'Accept-Language': 'es' } }
        );
        const geoData = await res.json();
        if (geoData.length) {
          payload.lat = parseFloat(geoData[0].lat);
          payload.lng = parseFloat(geoData[0].lon);
        }
      } catch (_) {}
    }

    if (editingLoc) {
      await supabase.from('locations').update(payload).eq('id', editingLoc.id);
    } else {
      if (!canAddLocation) { setSaving(false); return; }
      await supabase.from('locations').insert({ ...payload, tenant_id: tenant.id });
    }
    const empty = { name: '', cp: '', calle: '', colonia: '', municipio: '', estado: '', google_review_url: '', whatsapp_number: '' };
    setLocForm(empty);
    setCpStatus('idle');
    setColoniaOptions([]);
    setEditingLoc(null);
    setShowLocModal(false);
    await loadData();
    setSaving(false);
  };

  const handleEditLocation = (loc) => {
    setEditingLoc(loc);
    setLocForm({
      name:              loc.name              || '',
      cp:                loc.cp                || '',
      calle:             loc.calle             || '',
      colonia:           loc.colonia           || '',
      municipio:         loc.municipio         || '',
      estado:            loc.estado            || '',
      google_review_url: loc.google_review_url || '',
      whatsapp_number:   loc.whatsapp_number   || '',
    });
    setCpStatus(loc.cp ? 'found' : 'idle');
    setColoniaOptions(loc.colonia ? [loc.colonia] : []);
    setLocMenuOpen(null);
    setShowLocModal(true);
  };

  const handleDeleteLocation = async (loc) => {
    setLocMenuOpen(null);
    if (!window.confirm(`¿Eliminar "${loc.name}"? Se eliminarán también sus QRs y áreas.`)) return;
    await supabase.from('qr_codes').delete().eq('location_id', loc.id);
    await supabase.from('Areas_Catalogo').delete().eq('location_id', loc.id);
    await supabase.from('locations').delete().eq('id', loc.id);
    if (selectedLoc === loc.id) setSelectedLoc(null);
    await loadData();
  };

  const openEditQR = (qr) => {
    setEditingQR(qr);
    setEditQRForm({ label: qr.label, type: qr.type, area_id: qr.area_id || '', coupon_config_id: qr.coupon_config_id || '' });
    setShowEditQRModal(true);
  };

  const handleUpdateQR = async () => {
    if (!editingQR || !editQRForm.label.trim()) return;
    setSaving(true);
    const update = {
      label:            editQRForm.label.trim(),
      type:             editQRForm.type,
      area_id:          editQRForm.area_id          || null,
      coupon_config_id: editQRForm.coupon_config_id || null,
    };
    await supabase.from('qr_codes').update(update).eq('id', editingQR.id);
    setQrCodes(prev => prev.map(q => q.id === editingQR.id ? { ...q, ...update } : q));
    if (selectedQR?.id === editingQR.id) setSelectedQR(prev => ({ ...prev, ...update }));
    setShowEditQRModal(false);
    setEditingQR(null);
    setSaving(false);
  };

  const handleToggleActive = async (qr) => {
    const updated = { ...qr, active: !qr.active };
    setQrCodes(prev => prev.map(q => q.id === qr.id ? updated : q));
    if (selectedQR?.id === qr.id) setSelectedQR(updated);
    await supabase.from('qr_codes').update({ active: !qr.active }).eq('id', qr.id);
  };

  const openNewArea = () => {
    setEditingArea(null);
    setAreaForm({ nombre: '', coupon_config_id: '' });
    setShowAreaModal(true);
  };

  const openEditArea = (area) => {
    setEditingArea(area);
    setAreaForm({ nombre: area.nombre, coupon_config_id: area.coupon_config_id || '' });
    setShowAreaModal(true);
  };

  const handleSaveArea = async () => {
    if (!areaForm.nombre.trim() || !selectedLoc) return;
    setSaving(true);
    if (editingArea) {
      await supabase.from('Areas_Catalogo')
        .update({ nombre: areaForm.nombre.trim(), coupon_config_id: areaForm.coupon_config_id || null })
        .eq('id', editingArea.id);
    } else {
      await supabase.from('Areas_Catalogo').insert({
        tenant_id: tenant.id,
        location_id: selectedLoc,
        nombre: areaForm.nombre.trim(),
        coupon_config_id: areaForm.coupon_config_id || null,
      });
    }
    setShowAreaModal(false);
    await loadData();
    setSaving(false);
  };

  const handleDeleteArea = async (area) => {
    if (!window.confirm(`¿Eliminar el área "${area.nombre}"? Los QRs de esta área perderán la asociación.`)) return;
    await supabase.from('qr_codes').update({ area_id: null }).eq('area_id', area.id);
    await supabase.from('Areas_Catalogo').delete().eq('id', area.id);
    setAreas(prev => prev.filter(a => a.id !== area.id));
  };

  const handleAreaCoupon = async (areaId, couponConfigId) => {
    await supabase.from('Areas_Catalogo')
      .update({ coupon_config_id: couponConfigId || null })
      .eq('id', areaId);
    setAreas(prev => prev.map(a => a.id === areaId ? { ...a, coupon_config_id: couponConfigId || null } : a));
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
  const currentAreas    = areas.filter(a => a.location_id === selectedLoc);
  const orphanAreas     = areas.filter(a => !a.location_id);
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

      {/* ── Orphan areas banner ── */}
      {orphanAreas.length > 0 && (
        <div style={{ background: '#FFFBEB', borderBottom: `1px solid #FDE68A`, padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ fontSize: '1rem', lineHeight: 1 }}>⚠️</div>
          <div style={{ flex: 1, fontSize: '0.82rem', fontWeight: 700, color: '#92400E' }}>
            {orphanAreas.length} área{orphanAreas.length > 1 ? 's' : ''} sin sucursal asignada:{' '}
            {orphanAreas.map(a => a.nombre).join(', ')}
          </div>
          <button
            onClick={async () => {
              const ids = orphanAreas.map(a => a.id);
              await supabase.from('qr_codes').update({ area_id: null }).in('area_id', ids);
              await supabase.from('Areas_Catalogo').delete().in('id', ids);
              setAreas(prev => prev.filter(a => a.location_id !== null));
            }}
            style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid #B45309', background: '#B45309', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            Eliminar duplicados
          </button>
        </div>
      )}

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
              const menuOpen = locMenuOpen === loc.id;
              return (
                <div key={loc.id} style={{ position: 'relative', borderBottom: `1px solid ${T.border}` }}>
                  <div onClick={() => { setSelectedLoc(loc.id); setTypeFilter('all'); setRightTab('qrs'); setLocMenuOpen(null); }} style={{
                    padding: '12px 16px', cursor: 'pointer',
                    background: isActive ? T.coral + '08' : 'transparent',
                    borderLeft: `3px solid ${isActive ? T.coral : 'transparent'}`,
                    transition: 'all 0.12s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                      <span style={{
                        fontSize: '0.83rem', fontWeight: isActive ? 700 : 500,
                        color: isActive ? T.coral : T.ink,
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{loc.name}</span>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 600, color: T.muted,
                        background: '#F1F5F9', borderRadius: 999, padding: '2px 7px', flexShrink: 0,
                      }}>{qrs.length}</span>
                      <button
                        onClick={e => { e.stopPropagation(); setLocMenuOpen(menuOpen ? null : loc.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6, color: T.muted, flexShrink: 0, lineHeight: 1 }}
                      >
                        <MoreVertical size={14} />
                      </button>
                    </div>
                  </div>
                  {menuOpen && (
                    <>
                      <div onClick={() => setLocMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
                      <div style={{
                        position: 'absolute', right: 8, top: 36, zIndex: 51,
                        background: T.card, borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                        border: `1px solid ${T.border}`, minWidth: 150, overflow: 'hidden',
                      }}>
                        <button onClick={() => handleEditLocation(loc)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: font, fontSize: '0.82rem', color: T.ink, fontWeight: 600 }}>
                          <Edit2 size={13} /> Renombrar
                        </button>
                        <button onClick={() => handleDeleteLocation(loc)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: font, fontSize: '0.82rem', color: T.red, fontWeight: 600 }}>
                          <Trash2 size={13} /> Eliminar
                        </button>
                      </div>
                    </>
                  )}
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
                padding: '14px 24px', background: T.card,
                borderBottom: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: T.ink }}>{currentLocation?.name || '—'}</div>
                    <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 1 }}>
                      {currentAreas.length} área{currentAreas.length !== 1 ? 's' : ''} · {currentQRs.length} QRs
                    </div>
                  </div>
                  {/* Sub-tabs */}
                  <div style={{ display: 'flex', gap: 2, background: T.bg, borderRadius: 10, padding: 3, marginLeft: 8 }}>
                    {[{ key: 'areas', label: `📍 Áreas (${currentAreas.length})` }, { key: 'qrs', label: `🔲 QRs (${currentQRs.length})` }].map(t => (
                      <button key={t.key} onClick={() => setRightTab(t.key)} style={{
                        padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: rightTab === t.key ? T.card : 'transparent',
                        color: rightTab === t.key ? T.ink : T.muted,
                        fontFamily: font, fontSize: '0.75rem', fontWeight: rightTab === t.key ? 700 : 500,
                        boxShadow: rightTab === t.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                        transition: 'all .1s',
                      }}>{t.label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {rightTab === 'qrs' && currentQRs.length > 0 && (
                    <button onClick={() => printAll(currentQRs, currentLocation?.name, tenant?.test_mode)} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9,
                      border: `1px solid ${T.border}`, background: '#fff',
                      fontFamily: font, fontWeight: 600, fontSize: '0.78rem', color: T.muted, cursor: 'pointer',
                    }}>
                      <Printer size={13} /> Imprimir todos
                    </button>
                  )}
                  {rightTab === 'areas' && (
                    <button onClick={openNewArea} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: 'none',
                      background: T.teal, color: '#fff', fontFamily: font, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                    }}>
                      <Plus size={13} /> Nueva área
                    </button>
                  )}
                  {rightTab === 'qrs' && (
                    <button onClick={() => { setQrForm(f => ({ ...f, location_id: selectedLoc })); setShowQRModal(true); }} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 9, border: 'none',
                      background: T.coral, color: '#fff', fontFamily: font, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                    }}>
                      <Plus size={13} /> Nuevo QR
                    </button>
                  )}
                </div>
              </div>

              {/* Type filter (QRs tab only) */}
              {rightTab === 'qrs' && availableTypes.length > 1 && (
                <div style={{ padding: '10px 24px', background: T.card, borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 6, flexShrink: 0 }}>
                  {['all', ...availableTypes].map(type => {
                    const info = type === 'all' ? null : getTypeInfo(type);
                    const isActive = typeFilter === type;
                    return (
                      <button key={type} onClick={() => setTypeFilter(type)} style={{
                        padding: '5px 14px', borderRadius: 999,
                        border: `1.5px solid ${isActive ? (info?.color || T.ink) : T.border}`,
                        background: isActive ? (info?.color || T.ink) + (info ? '12' : '') : '#fff',
                        color: isActive ? (info?.color || T.ink) : T.muted,
                        fontFamily: font, fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.12s',
                      }}>
                        {type === 'all' ? 'Todos' : info?.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Areas tab ── */}
              {rightTab === 'areas' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                  {currentAreas.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📍</div>
                      <div style={{ fontWeight: 700, color: T.ink, marginBottom: 6 }}>Sin áreas en esta sucursal</div>
                      <div style={{ fontSize: '0.82rem', color: T.muted, marginBottom: 20 }}>
                        Las áreas te permiten asignar distintos cupones por zona: Cocina, Caja, Servicio, etc.
                      </div>
                      <button onClick={openNewArea} style={{
                        background: T.teal, color: '#fff', border: 'none', borderRadius: 10,
                        padding: '10px 22px', fontFamily: font, fontWeight: 700, fontSize: '0.88rem',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                        <Plus size={14} /> Nueva área
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {currentAreas.map(area => {
                        const assignedCoupon = couponConfigs.find(c => c.id === area.coupon_config_id);
                        const areaQRs = currentQRs.filter(q => q.area_id === area.id);
                        return (
                          <div key={area.id} style={{
                            background: T.card, borderRadius: 14, border: `1.5px solid ${T.border}`,
                            padding: '14px 18px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, color: T.ink, fontSize: '0.92rem', marginBottom: 6 }}>
                                  📍 {area.nombre}
                                  <span style={{ fontWeight: 500, fontSize: '0.72rem', color: T.muted, marginLeft: 8 }}>
                                    {areaQRs.length} QR{areaQRs.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                {/* Coupon selector inline */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <select
                                    value={area.coupon_config_id || ''}
                                    onChange={e => handleAreaCoupon(area.id, e.target.value)}
                                    style={{
                                      border: `1.5px solid ${assignedCoupon ? T.purple+'60' : T.border}`,
                                      borderRadius: 8, padding: '5px 10px',
                                      fontFamily: font, fontSize: '0.78rem', color: T.ink,
                                      background: assignedCoupon ? T.purple+'08' : '#fff',
                                      outline: 'none', cursor: 'pointer', maxWidth: 260,
                                    }}
                                  >
                                    <option value="">🎟 Sin cupón (usa global)</option>
                                    {couponConfigs.map(c => (
                                      <option key={c.id} value={c.id}>{c.name} — {c.offer_description}</option>
                                    ))}
                                  </select>
                                  {assignedCoupon && (
                                    <span style={{ fontSize: '0.68rem', color: T.purple, fontWeight: 700 }}>✓ asignado</span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button onClick={() => openEditArea(area)} style={{
                                  padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.border}`,
                                  background: '#fff', cursor: 'pointer', color: T.muted,
                                }}><Edit2 size={13} /></button>
                                <button onClick={() => handleDeleteArea(area)} style={{
                                  padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.border}`,
                                  background: '#fff', cursor: 'pointer', color: T.red,
                                }}><Trash2 size={13} /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ padding: '10px 12px', borderRadius: 10, background: T.bg, border: `1px solid ${T.border}`, fontSize: '0.72rem', color: T.muted, marginTop: 4 }}>
                        💡 El cupón del área aplica a todos sus QRs. Un QR puede sobreescribirlo individualmente.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── QR table ── */}
              {rightTab === 'qrs' && <div style={{ flex: 1, overflowY: 'auto' }}>
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
                              {qr.area_id && areas.find(a => a.id === qr.area_id) && (
                                <div style={{ fontSize: '0.65rem', color: T.teal, fontWeight: 600, marginTop: 1 }}>
                                  📍 {areas.find(a => a.id === qr.area_id).nombre}
                                </div>
                              )}
                              {qr.coupon_config_id && couponConfigs.find(c => c.id === qr.coupon_config_id) && (
                                <div style={{ fontSize: '0.65rem', color: T.purple, fontWeight: 700, marginTop: 1 }}>
                                  🎟 {couponConfigs.find(c => c.id === qr.coupon_config_id).name}
                                </div>
                              )}
                              {!qr.coupon_config_id && qr.area_id && areas.find(a => a.id === qr.area_id)?.coupon_config_id && couponConfigs.find(c => c.id === areas.find(a => a.id === qr.area_id).coupon_config_id) && (
                                <div style={{ fontSize: '0.65rem', color: T.purple, fontWeight: 600, marginTop: 1, opacity: 0.7 }}>
                                  🎟 ↑ {couponConfigs.find(c => c.id === areas.find(a => a.id === qr.area_id).coupon_config_id).name} (área)
                                </div>
                              )}
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
                                <button onClick={() => openEditQR(qr)} style={{
                                  display: 'flex', alignItems: 'center', gap: 5,
                                  padding: '6px 10px', borderRadius: 8,
                                  border: `1px solid ${T.border}`, background: '#fff',
                                  cursor: 'pointer', color: T.muted,
                                }}>
                                  <Edit2 size={13} />
                                </button>
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
              </div>}
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
        couponConfigs={couponConfigs}
        areas={areas}
      />

      {/* ── Edit QR Modal ── */}
      {showEditQRModal && editingQR && (
        <Modal title="Editar QR" onClose={() => { setShowEditQRModal(false); setEditingQR(null); }}>
          <FieldRow label="Etiqueta">
            <input
              style={inputSt}
              value={editQRForm.label}
              onChange={e => setEditQRForm(f => ({ ...f, label: e.target.value }))}
              autoFocus
            />
          </FieldRow>
          <FieldRow label="Tipo">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {QR_TYPES.map(t => {
                const active = editQRForm.type === t.value;
                return (
                  <button key={t.value} onClick={() => setEditQRForm(f => ({ ...f, type: t.value }))} style={{
                    padding: '9px 8px', borderRadius: 10, textAlign: 'center',
                    border: `2px solid ${active ? t.color : T.border}`,
                    background: active ? t.color + '10' : '#fff',
                    cursor: 'pointer', fontFamily: font,
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: active ? t.color : T.ink }}>{t.label}</div>
                  </button>
                );
              })}
            </div>
          </FieldRow>
          <FieldRow label="Área">
            <select
              style={inputSt}
              value={editQRForm.area_id}
              onChange={e => {
                const areaId = e.target.value;
                const area = areas.find(a => a.id === areaId);
                setEditQRForm(f => ({
                  ...f,
                  area_id: areaId,
                  coupon_config_id: areaId && area?.coupon_config_id && !f.coupon_config_id ? area.coupon_config_id : f.coupon_config_id,
                }));
              }}
            >
              <option value="">Sin área específica</option>
              {currentAreas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Cupón (opcional)">
            {couponConfigs.length === 0 ? (
              <div style={{ padding: '8px 12px', background: '#FFFBEB', border: `1px solid #FDE68A`, borderRadius: 10, fontSize: '0.78rem', color: '#92400E' }}>
                Sin cupones.{' '}
                <span onClick={() => navigate('/cupones')} style={{ fontWeight: 700, color: T.coral, cursor: 'pointer', textDecoration: 'underline' }}>Crear en Cupones → Catálogo</span>
              </div>
            ) : (
              <>
                <select
                  style={inputSt}
                  value={editQRForm.coupon_config_id}
                  onChange={e => setEditQRForm(f => ({ ...f, coupon_config_id: e.target.value }))}
                >
                  <option value="">
                    {editQRForm.area_id && areas.find(a => a.id === editQRForm.area_id)?.coupon_config_id
                      ? 'Heredado del área'
                      : 'Sin cupón específico (usa Recovery global)'}
                  </option>
                  {couponConfigs.map(c => <option key={c.id} value={c.id}>{c.name} — {c.offer_description}</option>)}
                </select>
                <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: 4 }}>
                  Selecciona solo si quieres sobreescribir el cupón del área.
                </div>
              </>
            )}
          </FieldRow>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleUpdateQR}
              disabled={saving || !editQRForm.label.trim()}
              style={{
                flex: 1, background: saving || !editQRForm.label.trim() ? T.muted : T.coral,
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '11px', fontFamily: font, fontWeight: 700, fontSize: '0.88rem',
                cursor: saving || !editQRForm.label.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button onClick={() => { setShowEditQRModal(false); setEditingQR(null); }} style={{
              padding: '11px 18px', borderRadius: 10, border: `1px solid ${T.border}`,
              background: '#fff', color: T.muted, cursor: 'pointer', fontFamily: font, fontWeight: 600,
            }}>Cancelar</button>
          </div>
        </Modal>
      )}

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
          {areas.length > 0 && (
            <FieldRow label="Área">
              <select style={inputSt} value={qrForm.area_id}
                onChange={e => {
                  const areaId = e.target.value;
                  const area = areas.find(a => a.id === areaId);
                  setQrForm(f => ({
                    ...f,
                    area_id: areaId,
                    // Auto-fill coupon from area if QR doesn't have one manually set
                    coupon_config_id: area?.coupon_config_id || f.coupon_config_id || '',
                  }));
                }}>
                <option value="">Sin área específica</option>
                {areas.filter(a => a.location_id === (qrForm.location_id || selectedLoc)).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </FieldRow>
          )}
          <FieldRow label="Etiqueta">
            <input style={inputSt} placeholder="ej: Mesa 1, Juan López, Turno Mañana"
              value={qrForm.label} onChange={e => setQrForm(f => ({ ...f, label: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAddQR()} autoFocus />
          </FieldRow>
          <FieldRow label="Cupón asignado (opcional)">
            {couponConfigs.length === 0 ? (
              <div style={{ padding: '10px 14px', background: '#FFFBEB', border: `1px solid #FDE68A`, borderRadius: 10, fontSize: '0.78rem', color: '#92400E', lineHeight: 1.5 }}>
                Sin cupones en el catálogo.{' '}
                <span onClick={() => navigate('/cupones')} style={{ fontWeight: 700, color: T.coral, cursor: 'pointer', textDecoration: 'underline' }}>
                  Crear en Cupones → Catálogo
                </span>
              </div>
            ) : (
              <>
                <select style={inputSt} value={qrForm.coupon_config_id}
                  onChange={e => setQrForm(f => ({ ...f, coupon_config_id: e.target.value }))}>
                  <option value="">
                    {qrForm.area_id && areas.find(a => a.id === qrForm.area_id)?.coupon_config_id
                      ? `Heredado del área`
                      : 'Sin cupón específico (usa Recovery global)'}
                  </option>
                  {couponConfigs.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.offer_description}</option>
                  ))}
                </select>
                <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: 4 }}>
                  El cupón del área se aplica automáticamente. Selecciona uno aquí solo para sobreescribirlo.
                </div>
              </>
            )}
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
      {/* ── Area Modal ── */}
      {showAreaModal && (
        <Modal title={editingArea ? 'Editar área' : 'Nueva área'} onClose={() => setShowAreaModal(false)}>
          <FieldRow label="Nombre del área">
            <input
              style={inputSt}
              placeholder="ej: Caja, Cocina, Terraza, Servicio"
              value={areaForm.nombre}
              onChange={e => setAreaForm(f => ({ ...f, nombre: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSaveArea()}
              autoFocus
            />
          </FieldRow>
          <FieldRow label="Cupón del área (opcional)">
            {couponConfigs.length === 0 ? (
              <div style={{ padding: '10px 14px', background: '#FFFBEB', border: `1px solid #FDE68A`, borderRadius: 10, fontSize: '0.78rem', color: '#92400E', lineHeight: 1.5 }}>
                Aún no tienes cupones en el catálogo.{' '}
                <span
                  onClick={() => navigate('/cupones')}
                  style={{ fontWeight: 700, color: T.coral, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Crea uno en Cupones → Catálogo
                </span>{' '}
                y regresa aquí para asignarlo.
              </div>
            ) : (
              <>
                <select
                  style={inputSt}
                  value={areaForm.coupon_config_id}
                  onChange={e => setAreaForm(f => ({ ...f, coupon_config_id: e.target.value }))}
                >
                  <option value="">Sin cupón específico (usa Recovery global)</option>
                  {couponConfigs.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.offer_description}</option>
                  ))}
                </select>
                <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: 4 }}>
                  Todos los QRs de esta área heredarán este cupón automáticamente.
                </div>
              </>
            )}
          </FieldRow>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleSaveArea}
              disabled={saving || !areaForm.nombre.trim()}
              style={{
                flex: 1, background: saving || !areaForm.nombre.trim() ? T.muted : T.teal,
                color: '#fff', border: 'none', borderRadius: 10,
                padding: '11px', fontFamily: font, fontWeight: 700, fontSize: '0.88rem',
                cursor: saving || !areaForm.nombre.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Guardando…' : editingArea ? 'Guardar cambios' : 'Crear área'}
            </button>
            <button onClick={() => setShowAreaModal(false)} style={{
              padding: '11px 18px', borderRadius: 10, border: `1px solid ${T.border}`,
              background: '#fff', color: T.muted, cursor: 'pointer', fontFamily: font, fontWeight: 600,
            }}>Cancelar</button>
          </div>
        </Modal>
      )}

      {showLocModal && (
        <Modal
          width={540}
          title={editingLoc ? 'Editar sucursal' : 'Nueva sucursal'}
          onClose={() => { setShowLocModal(false); setEditingLoc(null); setCpStatus('idle'); setColoniaOptions([]); setLocForm({ name: '', cp: '', calle: '', colonia: '', municipio: '', estado: '', google_review_url: '', whatsapp_number: '' }); }}
        >
          {/* ── Step 1: CP ── */}
          <FieldRow label="Código Postal">
            <div style={{ position: 'relative' }}>
              <input
                style={{
                  ...inputSt,
                  borderColor: cpStatus === 'found' ? T.teal : cpStatus === 'error' ? T.red : T.border,
                  paddingRight: 40, fontWeight: 700, fontSize: '1rem', letterSpacing: '0.05em',
                }}
                placeholder="06600"
                maxLength={5}
                value={locForm.cp}
                autoFocus
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '');
                  setLocForm(f => ({ ...f, cp: v }));
                  setCpStatus('idle');
                  setIsCustomColonia(false);
                  if (v.length === 5) lookupCP(v);
                }}
              />
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                {cpStatus === 'loading' && <Loader size={16} color={T.muted} style={{ animation: 'spin 1s linear infinite' }} />}
                {cpStatus === 'found'   && <Check size={16} color={T.teal} />}
                {cpStatus === 'error'   && <X size={16} color={T.red} />}
              </div>
            </div>
            {cpStatus === 'error' && (
              <div style={{ fontSize: '0.72rem', color: T.red, marginTop: 4 }}>CP no encontrado. Verifica o ingresa la dirección manualmente.</div>
            )}
          </FieldRow>

          {/* ── Auto-filled: Estado + Municipio ── */}
          {cpStatus === 'found' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Estado</label>
                <div style={{ ...inputSt, background: T.teal + '08', borderColor: T.teal + '40', color: T.ink, fontWeight: 600, cursor: 'default' }}>
                  {locForm.estado || '—'}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Municipio / Alcaldía</label>
                <div style={{ ...inputSt, background: T.teal + '08', borderColor: T.teal + '40', color: T.ink, fontWeight: 600, cursor: 'default' }}>
                  {locForm.municipio || '—'}
                </div>
              </div>
            </div>
          )}

          {/* ── Colonia ── */}
          {(cpStatus === 'found' || cpStatus === 'error' || editingLoc) && (
            <FieldRow label="Colonia">
              {coloniaOptions.length > 1 && !isCustomColonia ? (
                <div style={{ position: 'relative' }}>
                  <select
                    style={{ ...inputSt, fontWeight: coloniaOptions.find(c => c === locForm.colonia) ? 600 : 400 }}
                    value={locForm.colonia}
                    onChange={e => setLocForm(f => ({ ...f, colonia: e.target.value }))}
                  >
                    <option value="">Selecciona colonia…</option>
                    {coloniaOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsCustomColonia(true)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.72rem', color: T.teal, fontWeight: 700, fontFamily: font,
                      padding: '4px 0', marginTop: 4, display: 'block'
                    }}
                  >
                    ✎ No encuentro mi colonia (escribir manualmente)
                  </button>
                </div>
              ) : (
                <input
                  style={inputSt}
                  placeholder="Ej: Del Valle, Polanco, Roma Norte…"
                  value={locForm.colonia}
                  onChange={e => setLocForm(f => ({ ...f, colonia: e.target.value }))}
                />
              )}
            </FieldRow>
          )}

          {/* ── Calle ── */}
          {(cpStatus === 'found' || cpStatus === 'error' || editingLoc) && (
            <FieldRow label="Calle y número">
              <input
                style={inputSt}
                placeholder="Ej: Insurgentes Sur 1602, Local 4"
                value={locForm.calle}
                onChange={e => setLocForm(f => ({ ...f, calle: e.target.value }))}
              />
            </FieldRow>
          )}

          {/* ── Divider ── */}
          {(cpStatus === 'found' || editingLoc) && (
            <div style={{ borderTop: `1px solid ${T.border}`, margin: '16px 0' }} />
          )}

          {/* ── Nombre de la sucursal ── */}
          <FieldRow label="Nombre de la sucursal">
            <input
              style={inputSt}
              placeholder={locForm.colonia ? `Ej: Sucursal ${locForm.colonia}` : 'Ej: Sucursal Norte, Centro, Aeropuerto…'}
              value={locForm.name}
              onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))}
            />
          </FieldRow>

          {/* ── Google Reviews URL con tutorial ── */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: T.muted,
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              URL Google Reviews
              <span style={{ marginLeft: 6, color: T.coral, fontWeight: 800 }}>⚡ Importante</span>
            </label>

            {/* Warning when empty */}
            {!locForm.google_review_url && (
              <div style={{
                background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10,
                padding: '10px 14px', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400E', marginBottom: 2 }}>
                    Sin esta URL los clientes satisfechos NO serán redirigidos a Google
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#B45309' }}>
                    Configúrala para maximizar tus reseñas positivas automáticamente.
                  </div>
                </div>
              </div>
            )}

            <input style={inputSt} placeholder="https://g.page/r/…"
              value={locForm.google_review_url} onChange={e => setLocForm(f => ({ ...f, google_review_url: e.target.value }))} />

            {/* Tutorial colapsable */}
            <GoogleReviewTutorial />
          </div>

          <FieldRow label="WhatsApp del encargado (opcional)">
            <input style={inputSt} placeholder="5215512345678"
              value={locForm.whatsapp_number} onChange={e => setLocForm(f => ({ ...f, whatsapp_number: e.target.value }))} />
          </FieldRow>


          {!editingLoc && !canAddLocation && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, marginBottom: 12 }}>
              <Lock size={14} color={T.coral} />
              <span style={{ fontSize: '0.78rem', color: '#92400E', fontWeight: 600 }}>
                Límite de {planLimits.maxLocations} sucursal{planLimits.maxLocations > 1 ? 'es' : ''} en tu plan
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAddLocation}
              disabled={saving || !locForm.name.trim() || (!editingLoc && !canAddLocation)}
              style={{
                flex: 1, background: !locForm.name.trim() || (!editingLoc && !canAddLocation) ? T.muted : T.teal,
                color: '#fff', border: 'none', borderRadius: 10, padding: '11px',
                fontFamily: font, fontWeight: 700, fontSize: '0.88rem',
                cursor: !locForm.name.trim() || (!editingLoc && !canAddLocation) ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Guardando…' : editingLoc ? 'Guardar cambios' : 'Crear sucursal'}
            </button>
            <button
              onClick={() => { setShowLocModal(false); setEditingLoc(null); setCpStatus('idle'); setColoniaOptions([]); setLocForm({ name: '', cp: '', calle: '', colonia: '', municipio: '', estado: '', google_review_url: '', whatsapp_number: '' }); }}
              style={{ padding: '11px 18px', borderRadius: 10, border: `1px solid ${T.border}`, background: '#fff', color: T.muted, cursor: 'pointer', fontFamily: font, fontWeight: 600 }}
            >
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
