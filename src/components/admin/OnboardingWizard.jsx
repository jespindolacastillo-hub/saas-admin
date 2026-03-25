import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getTenantId } from '../../config/tenant';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { refreshMRR } from '../../services/mrrService';
import { ArrowRight, ArrowLeft, CheckCircle2, X, Zap, Search, Upload } from 'lucide-react';

// ─── Language Switcher ────────────────────────────────────────────────────────
const LANGS = [
  { code: 'es', flag: '🇲🇽', label: 'ES' },
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'pt', flag: '🇧🇷', label: 'PT' },
];

// ─── Confetti ─────────────────────────────────────────────────────────────────
const Confetti = () => {
  const colors = ['#FF5C3A', '#00C9A7', '#7C3AED', '#F59E0B', '#0D0D12', '#EC4899'];
  const pieces = Array.from({ length: 90 }).map((_, i) => ({
    id: i, color: colors[i % colors.length],
    left: `${Math.random() * 100}%`, delay: `${Math.random() * 1.5}s`,
    duration: `${2.5 + Math.random() * 2}s`, size: `${5 + Math.random() * 9}px`,
    shape: i % 3 === 0 ? '0%' : i % 3 === 1 ? '50%' : '2px',
  }));
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 99999, overflow: 'hidden' }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: '-20px', left: p.left,
          width: p.size, height: p.size, background: p.color, borderRadius: p.shape,
          animation: `fall ${p.duration} ${p.delay} ease-in forwards`,
        }} />
      ))}
      <style>{`@keyframes fall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(540deg);opacity:0}}`}</style>
    </div>
  );
};

// ─── Plan options ─────────────────────────────────────────────────────────────
const WIZARD_PLANS = [
  { slug: 'trial', label: '14 días gratis', name: 'Empezar prueba', price: '$0', period: '', note: 'Sin tarjeta de crédito', color: '#00C9A7', features: ['Acceso completo 14 días', 'QR ilimitados', 'Dashboard + alertas', '20 alertas WhatsApp'] },
  { slug: 'starter', label: 'Starter', name: 'Starter', price: '$349', period: '/mes', note: 'o $279/mes anual', color: '#FF5C3A', features: ['Todo Trial +', '50 alertas WhatsApp/mes', '2 usuarios', 'Email campañas'] },
  { slug: 'growth', label: 'Growth', name: 'Growth', price: '$599', period: '/mes', note: 'o $479/mes anual', color: '#7C3AED', features: ['Todo Starter +', '200 alertas WhatsApp/mes', 'Usuarios ilimitados', 'Mapa geográfico'] },
];

// ─── Business type picker ─────────────────────────────────────────────────────
const BIZ_TYPES = [
  { id: 'restaurant', emoji: '🍽️', label: 'Restaurante' },
  { id: 'retail',     emoji: '🛒', label: 'Tienda / Retail' },
  { id: 'hotel',      emoji: '🏨', label: 'Hotel / Hospedaje' },
  { id: 'health',     emoji: '🏋️', label: 'Salud / Bienestar' },
  { id: 'auto',       emoji: '🚗', label: 'Automotriz' },
  { id: 'services',   emoji: '💼', label: 'Servicios' },
  { id: 'medical',    emoji: '🏥', label: 'Médico / Dental' },
  { id: 'edu',        emoji: '🎓', label: 'Educación' },
];

// ─── Area presets by business type ────────────────────────────────────────────
const AREA_PRESETS_BY_BIZ = {
  restaurant: [
    { icon: '🍽', label: 'Salón / Comedor' },
    { icon: '🍹', label: 'Bar / Barra' },
    { icon: '🌿', label: 'Terraza' },
    { icon: '🛒', label: 'Caja' },
    { icon: '🚻', label: 'Sanitarios' },
    { icon: '✍️', label: 'Otro' },
  ],
  retail: [
    { icon: '🛒', label: 'Cajas' },
    { icon: '🚪', label: 'Entrada' },
    { icon: '👗', label: 'Probadores' },
    { icon: '📦', label: 'Almacén' },
    { icon: '📞', label: 'Atención al Cliente' },
    { icon: '✍️', label: 'Otro' },
  ],
  hotel: [
    { icon: '🏨', label: 'Recepción' },
    { icon: '🛏', label: 'Habitaciones' },
    { icon: '🍽', label: 'Restaurante' },
    { icon: '🏊', label: 'Alberca / Spa' },
    { icon: '🅿️', label: 'Estacionamiento' },
    { icon: '✍️', label: 'Otro' },
  ],
  health: [
    { icon: '🏋️', label: 'Gym / Sala Principal' },
    { icon: '🧘', label: 'Clases / Estudio' },
    { icon: '🚿', label: 'Vestidores' },
    { icon: '📋', label: 'Recepción' },
    { icon: '💆', label: 'Spa / Masajes' },
    { icon: '✍️', label: 'Otro' },
  ],
  auto: [
    { icon: '🔧', label: 'Taller / Servicio' },
    { icon: '🚗', label: 'Sala de Espera' },
    { icon: '🛒', label: 'Caja' },
    { icon: '🔍', label: 'Diagnóstico' },
    { icon: '🚘', label: 'Entrega de Vehículo' },
    { icon: '✍️', label: 'Otro' },
  ],
  services: [
    { icon: '🚪', label: 'Recepción' },
    { icon: '📞', label: 'Atención al Cliente' },
    { icon: '🛒', label: 'Caja / Cobro' },
    { icon: '🏢', label: 'Sala de Juntas' },
    { icon: '📋', label: 'Trámites' },
    { icon: '✍️', label: 'Otro' },
  ],
  medical: [
    { icon: '🏥', label: 'Recepción' },
    { icon: '🩺', label: 'Consultorios' },
    { icon: '💊', label: 'Farmacia' },
    { icon: '🔬', label: 'Laboratorio' },
    { icon: '🛏', label: 'Urgencias' },
    { icon: '✍️', label: 'Otro' },
  ],
  edu: [
    { icon: '🎓', label: 'Recepción / Control' },
    { icon: '📚', label: 'Aulas' },
    { icon: '🍽', label: 'Cafetería' },
    { icon: '🏟', label: 'Canchas / Deportivo' },
    { icon: '📖', label: 'Biblioteca' },
    { icon: '✍️', label: 'Otro' },
  ],
};
const DEFAULT_AREA_PRESETS = [
  { icon: '🚪', label: 'Entrada / Recepción' },
  { icon: '🛒', label: 'Cajas' },
  { icon: '📞', label: 'Atención al Cliente' },
  { icon: '🚻', label: 'Sanitarios' },
  { icon: '🍽', label: 'Comedor / Salón' },
  { icon: '✍️', label: 'Otro' },
];

// ─── Step metadata ────────────────────────────────────────────────────────────
const STEP_META = [
  { icon: '🏢', color: '#FF5C3A', gradient: 'linear-gradient(145deg,#0D0D12 0%,#2d1208 50%,#0D0D12 100%)', headline: 'Tu negocio', desc: 'Nombre, tipo y logo para que tu marca brille en cada QR.' },
  { icon: '📍', color: '#00C9A7', gradient: 'linear-gradient(145deg,#0D0D12 0%,#021f1a 50%,#0D0D12 100%)', headline: 'Tu primera sucursal', desc: 'Dirección en el mapa y teléfono para alertas por WhatsApp.' },
  { icon: '🗂️', color: '#0EA5E9', gradient: 'linear-gradient(145deg,#0D0D12 0%,#030f1f 50%,#0D0D12 100%)', headline: 'Área de evaluación', desc: 'El QR apuntará a este punto de contacto con el cliente.' },
  { icon: '💬', color: '#7C3AED', gradient: 'linear-gradient(145deg,#0D0D12 0%,#1a0a2e 50%,#0D0D12 100%)', headline: '¿Qué le preguntas a tus clientes?', desc: 'Personaliza la pregunta y mira el preview en vivo.' },
  { icon: '💰', color: '#10B981', gradient: 'linear-gradient(145deg,#0D0D12 0%,#011a10 50%,#0D0D12 100%)', headline: 'Activa la recuperación', desc: 'Ticket promedio + tu identidad para mensajes WhatsApp.' },
  { icon: '⚡', color: '#F59E0B', gradient: 'linear-gradient(145deg,#0D0D12 0%,#1f1600 50%,#0D0D12 100%)', headline: 'Elige tu plan y lanza', desc: 'Empieza gratis 14 días. Tu QR queda listo al instante.' },
];

const TOTAL_STEPS = 6;

// ─── Progress bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ current, total }) => (
  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
    {Array.from({ length: total - 1 }).map((_, i) => (
      <React.Fragment key={i}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${i <= current ? 'white' : 'rgba(255,255,255,0.25)'}`,
          background: i < current ? 'white' : i === current ? 'rgba(255,255,255,0.15)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.4s',
        }}>
          {i < current
            ? <CheckCircle2 size={13} color="#1e293b" />
            : <span style={{ fontSize: '0.65rem', fontWeight: '800', color: i === current ? 'white' : 'rgba(255,255,255,0.4)' }}>{i + 1}</span>}
        </div>
        <div style={{ flex: 1, height: '2px', background: i < current ? 'white' : 'rgba(255,255,255,0.2)', borderRadius: '2px', transition: 'background 0.4s' }} />
      </React.Fragment>
    ))}
    <div style={{
      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
      border: `2px solid ${total - 1 <= current ? 'white' : 'rgba(255,255,255,0.25)'}`,
      background: total - 1 < current ? 'white' : total - 1 === current ? 'rgba(255,255,255,0.15)' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {total - 1 < current
        ? <CheckCircle2 size={13} color="#1e293b" />
        : <span style={{ fontSize: '0.65rem', fontWeight: '800', color: total - 1 === current ? 'white' : 'rgba(255,255,255,0.4)' }}>{total}</span>}
    </div>
  </div>
);

// ─── Phone preview for step 3 ─────────────────────────────────────────────────
const PhonePreview = ({ question, tipo, logoUrl }) => {
  const q = question || '¿Cómo calificarías tu visita hoy?';
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{
        border: '6px solid #1e293b', borderRadius: '28px', width: '180px',
        overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.18)', background: 'white',
      }}>
        {/* Header */}
        <div style={{ background: '#FF5C3A', padding: '16px 12px 10px', textAlign: 'center' }}>
          {logoUrl
            ? <img src={logoUrl} alt="logo" style={{ height: '24px', objectFit: 'contain', maxWidth: '100px' }} />
            : <div style={{ fontWeight: 900, fontSize: '0.75rem', color: 'white', letterSpacing: '-0.02em' }}>retelio</div>}
          <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.9)', marginTop: '6px', lineHeight: 1.35, fontWeight: 700 }}>{q}</div>
        </div>
        {/* Response area */}
        <div style={{ padding: '14px 10px', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '6px' }}>
          {tipo === 'stars' && (
            <div style={{ fontSize: '1.3rem', letterSpacing: '2px' }}>⭐⭐⭐⭐⭐</div>
          )}
          {tipo === 'si_no' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ background: '#00C9A7', color: 'white', borderRadius: '8px', padding: '6px 14px', fontSize: '0.62rem', fontWeight: 800 }}>SÍ</div>
              <div style={{ background: '#FF5C3A', color: 'white', borderRadius: '8px', padding: '6px 14px', fontSize: '0.62rem', fontWeight: 800 }}>NO</div>
            </div>
          )}
          {tipo === 'nps' && (
            <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {Array.from({ length: 11 }, (_, i) => (
                <div key={i} style={{
                  width: '14px', height: '14px', borderRadius: '3px', fontSize: '0.42rem', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151',
                  background: i < 7 ? '#fecaca' : i < 9 ? '#fef3c7' : '#d1fae5',
                }}>{i}</div>
              ))}
            </div>
          )}
          {tipo === 'emoji' && (
            <div style={{ fontSize: '1.5rem', display: 'flex', gap: '6px' }}>😞 😐 😊 🤩</div>
          )}
        </div>
        {/* Powered by */}
        <div style={{ background: '#f8fafc', padding: '5px', textAlign: 'center', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.42rem', color: '#94a3b8' }}>Powered by retelio</div>
        </div>
      </div>
    </div>
  );
};

// ─── Smart question suggestions by giro + área ───────────────────────────────
const Q = {
  restaurant: {
    'Cajas':               [{ t:'¿Qué tan rápido fue tu proceso de pago?', tipo:'stars' }, { t:'¿La cuenta fue correcta?', tipo:'si_no' }],
    'Comedor / Salón':     [{ t:'¿Cómo calificarías tu experiencia gastronómica hoy?', tipo:'stars' }, { t:'¿La comida y el servicio superaron tus expectativas?', tipo:'emoji' }],
    'Entrada / Recepción': [{ t:'¿Cómo fue la bienvenida al llegar?', tipo:'stars' }],
    'Sanitarios':          [{ t:'¿Cómo encontraste los sanitarios?', tipo:'emoji' }, { t:'¿Los sanitarios estaban limpios y abastecidos?', tipo:'si_no' }],
  },
  retail: {
    'Cajas':               [{ t:'¿Qué tan satisfecho estás con la atención en caja?', tipo:'stars' }, { t:'¿El tiempo de espera fue razonable?', tipo:'si_no' }],
    'Entrada / Recepción': [{ t:'¿Cómo fue la atención al entrar a la tienda?', tipo:'stars' }, { t:'¿Encontraste fácilmente lo que buscabas?', tipo:'si_no' }],
    'Atención al Cliente': [{ t:'¿Resolvimos tu consulta o problema?', tipo:'si_no' }, { t:'¿Cómo fue la atención que recibiste?', tipo:'stars' }],
    'Sanitarios':          [{ t:'¿Cómo encontraste los sanitarios?', tipo:'emoji' }],
  },
  hotel: {
    'Entrada / Recepción': [{ t:'¿Cómo fue tu proceso de check-in?', tipo:'stars' }, { t:'¿El personal fue amable y eficiente?', tipo:'si_no' }],
    'Comedor / Salón':     [{ t:'¿Cómo calificarías el restaurante del hotel?', tipo:'stars' }],
    'Sanitarios':          [{ t:'¿Tu habitación e instalaciones estaban limpias?', tipo:'si_no' }],
  },
  health: {
    'Cajas':               [{ t:'¿Qué tan fácil fue tu proceso de pago o registro?', tipo:'stars' }],
    'Atención al Cliente': [{ t:'¿Te sentiste bien atendido y orientado?', tipo:'si_no' }, { t:'¿Cómo fue la atención del equipo?', tipo:'stars' }],
  },
  medical: {
    'Entrada / Recepción': [{ t:'¿Cómo fue el proceso de registro y tiempo de espera?', tipo:'stars' }, { t:'¿Fuiste atendido en tu horario de cita?', tipo:'si_no' }],
    'Atención al Cliente': [{ t:'¿Te sentiste escuchado y bien atendido?', tipo:'si_no' }],
  },
  auto: {
    'Cajas':               [{ t:'¿El proceso de cobro fue claro y justo?', tipo:'si_no' }],
    'Atención al Cliente': [{ t:'¿Recibiste una explicación clara del servicio?', tipo:'si_no' }, { t:'¿Cómo calificarías el servicio de tu vehículo?', tipo:'stars' }],
  },
  services: {
    'Atención al Cliente': [{ t:'¿Resolvimos tu necesidad hoy?', tipo:'si_no' }, { t:'¿Cómo calificarías la atención recibida?', tipo:'stars' }],
    'Cajas':               [{ t:'¿El proceso de pago fue sencillo y claro?', tipo:'si_no' }],
  },
  edu: {
    'Entrada / Recepción': [{ t:'¿Cómo fue el proceso de admisión o registro?', tipo:'stars' }],
    'Atención al Cliente': [{ t:'¿Recibiste orientación clara sobre tus dudas?', tipo:'si_no' }],
  },
};
const Q_DEFAULT = {
  'Cajas':               [{ t:'¿Qué tan satisfecho estás con la atención en caja?', tipo:'stars' }, { t:'¿El tiempo de espera fue razonable?', tipo:'si_no' }],
  'Entrada / Recepción': [{ t:'¿Cómo fue la bienvenida?', tipo:'stars' }],
  'Comedor / Salón':     [{ t:'¿Cómo calificarías tu experiencia hoy?', tipo:'stars' }],
  'Sanitarios':          [{ t:'¿Cómo encontraste los sanitarios?', tipo:'emoji' }, { t:'¿Los sanitarios estaban limpios?', tipo:'si_no' }],
  'Atención al Cliente': [{ t:'¿Resolvimos tu necesidad?', tipo:'si_no' }, { t:'¿Cómo fue la atención?', tipo:'stars' }],
  _default:              [{ t:'¿Cómo calificarías tu experiencia hoy?', tipo:'stars' }, { t:'¿El servicio cumplió tus expectativas?', tipo:'si_no' }, { t:'¿Nos recomendarías a un amigo?', tipo:'nps' }],
};
const getSmartSuggestions = (bizType, areaLabel) => {
  const byType = Q[bizType] || {};
  return byType[areaLabel] || Q_DEFAULT[areaLabel] || Q_DEFAULT._default;
};
const TIPO_LABELS = { stars:'⭐ Estrellas', si_no:'👍 Sí / No', nps:'📊 NPS', emoji:'😊 Emojis' };

// ─── SEPOMEX CP lookup (same API as QRStudio) ────────────────────────────────
const lookupCP = async (cp) => {
  try {
    const res = await fetch(`https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${cp}`);
    const data = await res.json();
    const zips = data.zip_codes || [];
    if (!zips.length) return null;
    const colonias = [...new Set(zips.map(z => z.d_asenta))].sort();
    const first = zips[0];
    return {
      colonias,
      municipio: first.D_mnpio || first.d_ciudad || '',
      estado: first.d_estado || '',
    };
  } catch { return null; }
};

const osmEmbedUrl = (lat, lng) => {
  const d = 0.004;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
};

// ─── Smart local question improver ───────────────────────────────────────────
const improveQuestion = (raw, bizType, areaName) => {
  let q = raw.trim();
  if (!q) return q;

  // 1. Fix irregular capitalization (Title Case mid-sentence → lowercase except first word)
  q = q.replace(/([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+)/g, (word, _, offset) => {
    if (offset === 0) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    // Keep acronyms
    if (word === word.toUpperCase() && word.length > 1) return word;
    return word.toLowerCase();
  });

  // 2. Remove extra spaces
  q = q.replace(/\s+/g, ' ').trim();

  // 3. Fix spacing around punctuation
  q = q.replace(/\s([?,!.])/g, '$1');

  // 4. Ensure ends with ?
  if (!/[?!]$/.test(q)) q += '?';

  // 5. Add opening ¿ if missing
  if (!q.startsWith('¿') && !q.startsWith('¡')) q = '¿' + q;

  // 6. Pattern rewrites — convert flat statements into engaging questions
  const rewrites = [
    // "fue correcta/buena/bien" patterns
    [/¿(.+?)\s+fue\s+correcta\?$/i, '¿$1 cumplió con tus expectativas?'],
    [/¿(.+?)\s+fue\s+bien\?$/i, '¿Cómo estuvo $1?'],
    [/¿(.+?)\s+estuvo\s+bien\?$/i, '¿Cómo estuvo $1?'],
    // "está/están bien" patterns
    [/¿(.+?)\s+está(?:n)?\s+bien\?$/i, '¿Cómo encontraste $1?'],
    // "hay/tiene" patterns
    [/¿(.+?)\s+(?:hay|tiene|había)\s+(.+?)\?$/i, '¿$1 contaba con $2?'],
    // Strip leading "La/El/Los/Las" from noun-first questions
    [/^¿(La|El|Los|Las)\s+([a-záéíóúüñ].+)/, (_, art, rest) => `¿${art} ${rest}`],
  ];

  for (const [pattern, replacement] of rewrites) {
    const replaced = q.replace(pattern, replacement);
    if (replaced !== q) { q = replaced; break; }
  }

  // 7. Final capitalization fix after rewrites
  q = q.charAt(0) + q.slice(1, 2).toUpperCase() + q.slice(2);
  // Make sure after ¿ is uppercase
  q = q.replace(/^¿(.)/, (_, c) => '¿' + c.toUpperCase());

  return q;
};

// ─── Main component ───────────────────────────────────────────────────────────
const OnboardingWizard = ({
  onComplete, session,
  initialStep = 0,
  stores = [], areas = [],
  refreshData = () => {},
  tenantRefresh = null,
}) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const logoInputRef = useRef(null);

  const [step, setStep]               = useState(initialStep);
  const [dir, setDir]                 = useState(1);
  const [visible, setVisible]         = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  // Step 0 — business identity
  const [orgName, setOrgName]         = useState('');
  const [bizType, setBizType]         = useState('');
  const [logoFile, setLogoFile]       = useState(null);     // File object
  const [logoPreview, setLogoPreview] = useState('');       // data URL for preview
  const [logoDragging, setLogoDragging] = useState(false);

  // Step 1 — branch
  const [storeName, setStoreName]     = useState(initialStep > 1 && stores.length ? stores[0]?.nombre || '' : '');
  const [cp, setCp]                   = useState('');
  const [cpStatus, setCpStatus]       = useState('idle'); // idle | loading | found | error
  const [coloniaOptions, setColoniaOptions] = useState([]);
  const [calle, setCalle]             = useState('');
  const [colonia, setColonia]         = useState('');
  const [municipio, setMunicipio]     = useState('');
  const [estado, setEstado]           = useState('');
  const [mapCoords, setMapCoords]     = useState(null);
  const [geoLoading, setGeoLoading]   = useState(false);
  const [phone, setPhone]             = useState('');

  // Step 2 — area
  const [areaPreset, setAreaPreset]   = useState(null);    // index into AREA_PRESETS
  const [areaCustom, setAreaCustom]   = useState('');      // custom label when "Otro"

  // Step 3 — question
  const [questionText, setQuestionText] = useState('');
  const [tipoRespuesta, setTipoRespuesta] = useState('stars');
  const [improving, setImproving]       = useState(false);

  // Step 4 — recovery (always start blank — saved to localStorage on proceed)
  const [avgTicket, setAvgTicket]     = useState('');
  const [senderName, setSenderName]   = useState('');
  const [senderRole, setSenderRole]   = useState('');

  // Step 5 — plan
  const [selectedPlan, setSelectedPlan] = useState('trial');

  // Saved DB IDs
  const [savedTenantId, setSavedTenantId]     = useState(null);
  const [savedStoreId, setSavedStoreId]       = useState(initialStep > 1 && stores.length ? stores[0]?.id || null : null);
  const [savedAreaId, setSavedAreaId]         = useState(initialStep > 2 && areas.length ? areas[0]?.id || null : null);
  const [savedLocationId, setSavedLocationId] = useState(null);

  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // ── Helpers ──
  const transition = (newStep, direction = 1) => {
    setDir(direction);
    setVisible(false);
    setTimeout(() => { setStep(newStep); setError(''); setVisible(true); }, 250);
  };

  const goBack = () => step > 0 && transition(step - 1, -1);

  const currentAreaPresets = AREA_PRESETS_BY_BIZ[bizType] || DEFAULT_AREA_PRESETS;
  const isOtroPreset = areaPreset !== null && currentAreaPresets[areaPreset]?.label === 'Otro';
  const areaName = areaPreset !== null
    ? (isOtroPreset && areaCustom.trim() ? areaCustom.trim() : currentAreaPresets[areaPreset].label)
    : '';

  // ── Logo drag & drop ──
  const handleLogoFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  // ── CP lookup via SEPOMEX (same as QRStudio) ──
  const handleCpChange = async (val) => {
    const clean = val.replace(/\D/g, '');
    setCp(clean);
    if (clean.length !== 5) { setCpStatus('idle'); setColoniaOptions([]); return; }
    setCpStatus('loading');
    setColoniaOptions([]);
    const result = await lookupCP(clean);
    if (result) {
      setColoniaOptions(result.colonias);
      setMunicipio(result.municipio);
      setEstado(result.estado);
      setColonia(result.colonias.length === 1 ? result.colonias[0] : '');
      setCpStatus('found');
      // Geocode for map using municipio + estado + CP
      setGeoLoading(true);
      try {
        const q = `${result.municipio}, ${result.estado}, México`;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.length) setMapCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } catch (_) {}
      setGeoLoading(false);
    } else {
      setCpStatus('error');
      setError('CP no encontrado. Verifica el número.');
    }
  };

  // ── Save step 0 → 1 (just local state, no DB yet) ──
  const saveStep0 = () => {
    if (!orgName.trim()) return;
    transition(1);
  };

  // ── Save step 1 → 2 (create tenant + store + location) ──
  const saveStep1 = async () => {
    if (!storeName.trim()) return;
    setSaving(true); setError('');
    try {
      const tid = getTenantId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let validTid = tid;

      if (!tid || !uuidRegex.test(tid) || tid === '00000000-0000-0000-0000-000000000000') {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Debes iniciar sesión primero.');

        const refCode = localStorage.getItem('retelio_ref') || null;
        let affiliateId = null;
        if (refCode) {
          const { data: aff } = await supabase.from('affiliates').select('id').eq('ref_code', refCode).eq('active', true).maybeSingle();
          if (aff) affiliateId = aff.id;
        }
        const utmRaw = localStorage.getItem('retelio_utm');
        const utm = utmRaw ? JSON.parse(utmRaw) : {};

        const { data: newTenant, error: tenantErr } = await supabase.from('tenants').insert([{
          name: orgName.trim() || storeName.trim(),
          test_mode: true,
          ...(refCode     && { ref_code_used: refCode }),
          ...(affiliateId && { affiliate_id: affiliateId }),
          ...(utm.utm_source   && { utm_source: utm.utm_source }),
          ...(utm.utm_medium   && { utm_medium: utm.utm_medium }),
          ...(utm.utm_campaign && { utm_campaign: utm.utm_campaign }),
          ...(utm.utm_content  && { utm_content: utm.utm_content }),
          ...(utm.utm_term     && { utm_term: utm.utm_term }),
        }]).select('id').single();
        if (tenantErr) throw tenantErr;
        validTid = newTenant.id;
        if (refCode) localStorage.removeItem('retelio_ref');
        if (utmRaw)  localStorage.removeItem('retelio_utm');
        setSavedTenantId(validTid);

        const { error: userUpdateErr } = await supabase.from('Usuarios').upsert({
          id: user.id, email: user.email, tenant_id: validTid,
          nombre: user.user_metadata?.nombre || '', rol: 'admin', activo: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' });
        if (userUpdateErr) throw userUpdateErr;
      } else {
        // Update existing tenant with new info
        await supabase.from('tenants').update({
          name: orgName.trim() || undefined,
        }).eq('id', validTid);
      }

      // Upload logo: try Storage first, fallback to base64 in DB
      if (logoFile && validTid) {
        try {
          const ext = logoFile.name.split('.').pop();
          const path = `${validTid}/logo.${ext}`;
          const { error: upErr } = await supabase.storage.from('tenant-logos').upload(path, logoFile, { upsert: true });
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('tenant-logos').getPublicUrl(path);
            await supabase.from('tenants').update({ logo_url: publicUrl }).eq('id', validTid);
          } else {
            // Storage bucket not configured — save as base64 directly
            const base64 = await new Promise(resolve => {
              const r = new FileReader();
              r.onload = e => resolve(e.target.result);
              r.readAsDataURL(logoFile);
            });
            await supabase.from('tenants').update({ logo_url: base64 }).eq('id', validTid);
          }
        } catch (_) { /* logo is non-critical */ }
      }

      // Create store (idempotent by name)
      let storeIdToUse = savedStoreId;
      if (!storeIdToUse) {
        const { data: existingStore } = await supabase.from('Tiendas_Catalogo').select('id').eq('nombre', storeName.trim()).eq('tenant_id', validTid).maybeSingle();
        if (existingStore?.id) {
          storeIdToUse = existingStore.id;
        } else {
          const { data: newStore, error: storeErr } = await supabase.from('Tiendas_Catalogo').insert([{
            nombre: storeName.trim(), tenant_id: validTid,
          }]).select('id').single();
          if (storeErr) throw storeErr;
          storeIdToUse = newStore.id;
        }
        setSavedStoreId(storeIdToUse);
      }

      // Create location record (idempotent — skip if already created this session)
      if (!savedLocationId) {
        try {
          // Check if a location with this name already exists for this tenant
          const { data: existingLoc } = await supabase.from('locations')
            .select('id').eq('name', storeName.trim()).eq('tenant_id', validTid).maybeSingle();

          if (existingLoc?.id) {
            setSavedLocationId(existingLoc.id);
          } else {
            // Re-geocode at save time using all available address fields for better precision
            let coords = mapCoords;
            if (!coords && (municipio || estado)) {
              try {
                const q = [calle.trim(), colonia.trim(), municipio.trim(), estado.trim(), 'México'].filter(Boolean).join(', ');
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`);
                const geoData = await geoRes.json();
                if (geoData.length) coords = { lat: parseFloat(geoData[0].lat), lng: parseFloat(geoData[0].lon) };
              } catch (_) {}
            }

            const { data: newLoc } = await supabase.from('locations').insert({
              tenant_id: validTid,
              name: storeName.trim(),
              cp:         cp.trim()        || null,
              calle:      calle.trim()     || null,
              colonia:    colonia.trim()   || null,
              municipio:  municipio.trim() || null,
              estado:     estado.trim()    || null,
              whatsapp_number: phone.trim() || null,
              ...(coords && { lat: coords.lat, lng: coords.lng }),
            }).select('id').single();
            if (newLoc?.id) setSavedLocationId(newLoc.id);
          }
        } catch (_) { /* non-critical */ }
      }

      refreshMRR(validTid);
      await refreshData();
      transition(2);
    } catch (err) {
      console.error('Wizard step 1 error:', err);
      setError(err.message || 'Error al guardar.');
    }
    setSaving(false);
  };

  // ── Save step 2 → 3 (create area) ──
  const saveStep2 = async () => {
    if (areaPreset === null) return;
    if (isOtroPreset && !areaCustom.trim()) return;
    setSaving(true); setError('');
    try {
      const tid = savedTenantId || getTenantId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let validTid = tid;
      if (!tid || !uuidRegex.test(tid) || tid === '00000000-0000-0000-0000-000000000000') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: ud } = await supabase.from('Usuarios').select('tenant_id').eq('email', user.email).maybeSingle();
          if (ud?.tenant_id) { validTid = ud.tenant_id; setSavedTenantId(validTid); }
        }
      }

      const label = areaName;
      if (label && !savedAreaId) {
        const { data: newArea, error: aErr } = await supabase.from('Areas_Catalogo').insert([{
          nombre: label, tenant_id: validTid, tienda_id: savedStoreId,
          location_id: savedLocationId || null,
        }]).select('id').single();
        if (aErr) throw aErr;
        setSavedAreaId(newArea.id);

        // QR codes table — linked to the location created in step 1
        try {
          await supabase.from('qr_codes').insert({
            tenant_id: validTid,
            location_id: savedLocationId || null,
            area_id: newArea.id,
            type: 'area',
            label,
          });
        } catch (_) {}
      }

      await refreshData();
      transition(3);
    } catch (err) {
      setError(err.message || 'Error al crear área.');
    }
    setSaving(false);
  };

  // ── Save step 3 → 4 (create question) ──
  const saveStep3 = async () => {
    if (!questionText.trim()) return;
    setSaving(true); setError('');
    try {
      const tid = savedTenantId || getTenantId();
      const finalAreaId = savedAreaId || (areas.length > 0 ? areas[0]?.id : null);
      if (finalAreaId && tid && tid !== '00000000-0000-0000-0000-000000000000') {
        const { error: qErr } = await supabase.from('Area_Preguntas').insert([{
          area_id: finalAreaId, tenant_id: tid,
          numero_pregunta: 1, texto_pregunta: questionText.trim(),
          tipo_respuesta: tipoRespuesta, activa: true,
        }]);
        if (qErr) throw qErr;
      }
      await refreshData();
      transition(4);
    } catch (err) {
      setError(err.message || 'Error al guardar pregunta.');
    }
    setSaving(false);
  };

  // ── Save step 4 → 5 (ticket + sender — mostly localStorage) ──
  const saveStep4 = async () => {
    setSaving(true);
    try {
      if (avgTicket) {
        localStorage.setItem('retelio_avg_ticket', avgTicket);
        const tid = savedTenantId || getTenantId();
        if (tid && tid !== '00000000-0000-0000-0000-000000000000') {
          try { await supabase.from('tenants').update({ avg_ticket: parseFloat(avgTicket) }).eq('id', tid); } catch (_) {}
        }
      }
      if (senderName) localStorage.setItem('wa_sender_name', senderName);
      if (senderRole) localStorage.setItem('wa_sender_role', senderRole);
      transition(5);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  // ── Save step 5 → done (plan + launch) ──
  const saveStep5 = async () => {
    setSaving(true); setError('');
    try {
      const tid = savedTenantId || getTenantId();
      if (tid && tid !== '00000000-0000-0000-0000-000000000000') {
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        await supabase.from('tenants').update({
          plan: selectedPlan === 'trial' ? 'trial' : selectedPlan,
          plan_status: 'trial',
          trial_starts_at: now.toISOString(),
          trial_ends_at: trialEnd.toISOString(),
        }).eq('id', tid);
        if (tenantRefresh) await tenantRefresh();
      }
      setShowConfetti(true);
      localStorage.setItem('onboarding_complete', 'true');
      setTimeout(() => {
        setShowConfetti(false);
        onComplete();
        navigate('/qr');
      }, 3000);
    } catch (err) {
      setError(err.message || 'Error al activar plan.');
    }
    setSaving(false);
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding_complete', 'true');
    onComplete();
  };

  const handleNext = () => {
    if (step === 0) saveStep0();
    else if (step === 1) saveStep1();
    else if (step === 2) saveStep2();
    else if (step === 3) saveStep3();
    else if (step === 4) saveStep4();
    else if (step === 5) saveStep5();
  };

  const canProceed = (() => {
    if (step === 0) return !!orgName.trim();
    if (step === 1) return !!storeName.trim() && cp.length === 5;
    if (step === 2) return areaPreset !== null && (!isOtroPreset || !!areaCustom.trim());
    if (step === 3) return !!questionText.trim();
    return true;
  })();

  const meta = STEP_META[step] || STEP_META[0];
  const feedbackBaseUrl = (import.meta.env.VITE_FEEDBACK_URL || window.location.origin + '/feedback');
  const tid = savedTenantId || getTenantId() || '00000000-0000-0000-0000-000000000000';
  const qrUrl = savedStoreId
    ? `${feedbackBaseUrl}?tid=${tid}&t=${savedStoreId}${savedAreaId ? `&a=${savedAreaId}` : ''}`
    : feedbackBaseUrl;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {showConfetti && <Confetti />}

      {/* ══ LEFT PANEL ══ */}
      <div style={{
        width: '40%', flexShrink: 0,
        background: meta.gradient,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '2.5rem', position: 'relative', overflow: 'hidden',
        transition: 'background 0.5s ease',
      }} className="wiz-left">
        <style>{`
          @media (max-width:768px){.wiz-left{display:none!important}.wiz-right{width:100%!important}}
          @keyframes panelEntry{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        `}</style>

        {/* Decorative blobs */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', width: '350px', height: '350px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', top: '-100px', left: '-80px' }} />
          <div style={{ position: 'absolute', width: '250px', height: '250px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', bottom: '-50px', right: '-60px' }} />
          <div style={{ position: 'absolute', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', top: '40%', left: '60%' }} />
        </div>

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', width: '24px', height: '24px' }}>
              <div style={{ borderRadius: '3px', background: '#FF5C3A' }} />
              <div style={{ borderRadius: '3px', background: '#00C9A7' }} />
              <div style={{ borderRadius: '3px', background: '#7C3AED' }} />
              <div style={{ borderRadius: '3px', background: 'rgba(255,255,255,0.3)' }} />
            </div>
            <span style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontWeight: 800, fontSize: '1.1rem', color: 'white', letterSpacing: '-0.02em' }}>retelio</span>
          </div>
        </div>

        {/* Step content */}
        <div style={{ position: 'relative', zIndex: 1, animation: 'panelEntry 0.4s ease' }} key={step}>
          <div style={{ fontSize: '4.5rem', lineHeight: '1', marginBottom: '1.25rem' }}>{meta.icon}</div>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '100px', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Paso {step + 1} / {TOTAL_STEPS}
            </span>
          </div>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: '1.85rem', fontWeight: '900', color: 'white', lineHeight: '1.15', letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>
            {meta.headline}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.65)', lineHeight: '1.6', maxWidth: '300px' }}>
            {meta.desc}
          </p>
        </div>

        {/* Progress */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <ProgressBar current={step} total={TOTAL_STEPS} />
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div className="wiz-right" style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        {/* Top bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.25rem 2.5rem', background: 'white', borderBottom: '1px solid #f1f5f9', flexShrink: 0,
        }}>
          {step > 0 && step < 5
            ? <button onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', padding: 0 }}>
                <ArrowLeft size={16} /> Atrás
              </button>
            : <div />}

          {/* Mobile lang switcher */}
          <div style={{ display: 'flex', gap: '4px' }} className="wiz-mobile-lang">
            <style>{`@media (min-width:769px){.wiz-mobile-lang{display:none!important}}`}</style>
            {LANGS.map(l => (
              <button key={l.code} onClick={() => i18n.changeLanguage(l.code)}
                style={{ padding: '4px 8px', borderRadius: '20px', border: `1.5px solid ${i18n.language === l.code ? '#FF5C3A' : '#e2e8f0'}`, background: i18n.language === l.code ? '#FFF1EE' : 'white', color: i18n.language === l.code ? '#FF5C3A' : '#94a3b8', fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer' }}>
                {l.flag} {l.label}
              </button>
            ))}
          </div>

          <button onClick={handleSkip} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', padding: '6px 12px', borderRadius: '8px' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <X size={14} /> Saltar
          </button>
        </div>

        {/* Form content */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 2.5rem' }}>
          <div style={{
            width: '100%', maxWidth: '520px',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : `translateY(${dir * 16}px)`,
            transition: 'opacity 0.25s ease, transform 0.25s ease',
          }}>

            {/* ── Step 0: Negocio ── */}
            {step === 0 && (
              <div>
                <SectionHead title="¿Cómo se llama tu negocio?" sub="Aparecerá en tus QRs y reportes. Puedes cambiarlo después." />

                <label style={LS}>Nombre de la empresa *</label>
                <input autoFocus type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && orgName.trim() && saveStep0()}
                  placeholder="ej. Price Shoes Guadalajara"
                  style={IS(!!orgName)} />

                <label style={{ ...LS, marginTop: '1.5rem' }}>Tipo de negocio</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '1.5rem' }}>
                  {BIZ_TYPES.map(bt => (
                    <button key={bt.id} type="button" onClick={() => setBizType(bt.id)}
                      style={{
                        padding: '0.7rem 0.4rem', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                        border: `2px solid ${bizType === bt.id ? '#FF5C3A' : '#e2e8f0'}`,
                        background: bizType === bt.id ? '#FFF1EE' : 'white', transition: 'all 0.15s',
                      }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{bt.emoji}</div>
                      <div style={{ fontSize: '0.62rem', fontWeight: '700', color: bizType === bt.id ? '#FF5C3A' : '#475569', lineHeight: 1.2 }}>{bt.label}</div>
                    </button>
                  ))}
                </div>

                {/* Logo upload */}
                <label style={LS}>Logo de tu marca <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'none' }}>(opcional)</span></label>
                <div
                  onClick={() => logoInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setLogoDragging(true); }}
                  onDragLeave={() => setLogoDragging(false)}
                  onDrop={e => { e.preventDefault(); setLogoDragging(false); handleLogoFile(e.dataTransfer.files[0]); }}
                  style={{
                    border: `2px dashed ${logoDragging ? '#FF5C3A' : logoPreview ? '#00C9A7' : '#e2e8f0'}`,
                    borderRadius: '14px', padding: '1.25rem', textAlign: 'center', cursor: 'pointer',
                    background: logoDragging ? '#FFF1EE' : logoPreview ? '#f0fdf4' : '#fafafa',
                    transition: 'all 0.2s',
                  }}>
                  {logoPreview
                    ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                        <img src={logoPreview} alt="logo" style={{ height: '48px', objectFit: 'contain', borderRadius: '8px' }} />
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#065f46' }}>✓ Logo cargado</div>
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Clic para cambiar</div>
                        </div>
                      </div>
                    : <div>
                        <Upload size={22} color="#94a3b8" style={{ margin: '0 auto 6px' }} />
                        <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#475569' }}>Arrastra tu logo aquí o haz clic</div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '3px' }}>PNG, JPG, SVG — recomendado fondo transparente</div>
                      </div>}
                  <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => handleLogoFile(e.target.files[0])} />
                </div>
              </div>
            )}

            {/* ── Step 1: Sucursal ── */}
            {step === 1 && (
              <div>
                <SectionHead title="Tu primera sucursal" sub="Nombre, ubicación y teléfono para alertas WhatsApp." />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  <div>
                    <label style={LS}>Nombre de la sucursal *</label>
                    <input autoFocus type="text" value={storeName} onChange={e => setStoreName(e.target.value)}
                      placeholder="ej. Sucursal Interlomas" style={IS(!!storeName)} />
                  </div>

                  {/* CP → SEPOMEX → colonias dropdown */}
                  <div>
                    <label style={LS}>
                      Código postal *
                      {cpStatus === 'loading' && <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: '8px', textTransform: 'none' }}>Buscando…</span>}
                      {cpStatus === 'found'   && <span style={{ fontWeight: 400, color: '#00C9A7', marginLeft: '8px', textTransform: 'none' }}>✓ {municipio}</span>}
                      {cpStatus === 'error'   && <span style={{ fontWeight: 400, color: '#ef4444', marginLeft: '8px', textTransform: 'none' }}>CP no encontrado</span>}
                    </label>
                    <input type="text" inputMode="numeric" maxLength={5} value={cp}
                      onChange={e => handleCpChange(e.target.value)}
                      placeholder="ej. 53900" style={IS(cpStatus === 'found')} />
                  </div>

                  {/* Mapa al ubicar */}
                  {mapCoords && !geoLoading && (
                    <div style={{ borderRadius: '14px', overflow: 'hidden', border: '2px solid #00C9A7' }}>
                      <iframe title="map" src={osmEmbedUrl(mapCoords.lat, mapCoords.lng)}
                        style={{ width: '100%', height: '150px', border: 'none' }} loading="lazy" />
                    </div>
                  )}

                  {/* Municipio / Estado — auto-llenados */}
                  {cpStatus === 'found' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={LS}>Municipio / Alcaldía</label>
                        <input type="text" value={municipio} onChange={e => setMunicipio(e.target.value)}
                          style={IS(!!municipio)} />
                      </div>
                      <div>
                        <label style={LS}>Estado</label>
                        <input type="text" value={estado} onChange={e => setEstado(e.target.value)}
                          style={IS(!!estado)} />
                      </div>
                    </div>
                  )}

                  {/* Colonia — dropdown si hay opciones, input si no */}
                  {cpStatus === 'found' && (
                    <div>
                      <label style={LS}>Colonia <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'none' }}>(opcional)</span></label>
                      {coloniaOptions.length > 1
                        ? <select value={colonia} onChange={e => setColonia(e.target.value)}
                            style={{ ...IS(!!colonia), appearance: 'none', cursor: 'pointer' }}>
                            <option value="">Selecciona una colonia…</option>
                            {coloniaOptions.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        : <input type="text" value={colonia} onChange={e => setColonia(e.target.value)}
                            placeholder="ej. Viveros de la Loma" style={IS(!!colonia)} />}
                    </div>
                  )}

                  {/* Calle */}
                  {cpStatus === 'found' && (
                    <div>
                      <label style={LS}>Calle y número <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'none' }}>(opcional)</span></label>
                      <input type="text" value={calle} onChange={e => setCalle(e.target.value)}
                        placeholder="ej. Eje Satélite Tlalnepantla 9" style={IS(!!calle)} />
                    </div>
                  )}

                  <div>
                    <label style={LS}>Teléfono WhatsApp <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'none' }}>(incluye lada)</span></label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="ej. 55 5073 3331" style={IS(!!phone)} />
                  </div>
                </div>

                {error && <ErrBox msg={error} onClearSession={() => { localStorage.removeItem('saas_tenant_config'); window.location.reload(); }} onSignOut={async () => { localStorage.clear(); await supabase.auth.signOut(); window.location.reload(); }} />}
              </div>
            )}

            {/* ── Step 2: Área ── */}
            {step === 2 && (
              <div>
                <SectionHead title="¿Dónde quieres colocar el primer QR?" sub="Selecciona el área que quieres evaluar." />
                <label style={LS}>Área de evaluación *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                  {currentAreaPresets.map((p, i) => (
                    <button key={i} type="button" onClick={() => { setAreaPreset(i); setAreaCustom(''); }}
                      style={{
                        padding: '0.9rem 0.5rem', borderRadius: '14px', cursor: 'pointer', textAlign: 'center',
                        border: `2px solid ${areaPreset === i ? '#0EA5E9' : '#e2e8f0'}`,
                        background: areaPreset === i ? '#e0f2fe' : 'white', transition: 'all 0.15s',
                      }}>
                      <div style={{ fontSize: '1.6rem', marginBottom: '5px' }}>{p.icon}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: '700', color: areaPreset === i ? '#0369a1' : '#475569' }}>{p.label}</div>
                    </button>
                  ))}
                </div>

                {isOtroPreset && (
                  <div>
                    <label style={LS}>¿Cómo se llama esta área? *</label>
                    <input autoFocus type="text" value={areaCustom} onChange={e => setAreaCustom(e.target.value)}
                      placeholder="ej. Área de Ventas, Taller, Terraza…"
                      style={IS(!!areaCustom)} />
                  </div>
                )}

                {areaPreset !== null && !isOtroPreset && (
                  <div style={{ background: '#e0f2fe', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.1rem' }}>{currentAreaPresets[areaPreset].icon}</span>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0369a1' }}>Área: {currentAreaPresets[areaPreset].label}</div>
                      <div style={{ fontSize: '0.68rem', color: '#0284c7' }}>Tu QR quedará etiquetado con esta área.</div>
                    </div>
                  </div>
                )}
                {isOtroPreset && areaCustom.trim() && (
                  <div style={{ background: '#e0f2fe', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', gap: '10px', alignItems: 'center', marginTop: '0.75rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>✍️</span>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0369a1' }}>Área: {areaCustom.trim()}</div>
                      <div style={{ fontSize: '0.68rem', color: '#0284c7' }}>Tu QR quedará etiquetado con esta área.</div>
                    </div>
                  </div>
                )}
                {error && <ErrBox msg={error} />}
              </div>
            )}

            {/* ── Step 3: Pregunta ── */}
            {step === 3 && (
              <div>
                <SectionHead title="¿Qué le preguntas a tus clientes?" sub="Personaliza el texto y ve cómo se verá en el formulario." />

                <label style={LS}>Tipo de respuesta</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {[
                    { v: 'stars', e: '⭐', t: 'Estrellas 1–5', s: 'Opinión escalada' },
                    { v: 'si_no', e: '👍', t: 'Sí / No', s: 'Respuesta binaria' },
                    { v: 'nps',   e: '📊', t: 'NPS 0–10', s: 'Probabilidad de rec.' },
                    { v: 'emoji', e: '😊', t: 'Emojis', s: 'Visualmente intuitivo' },
                  ].map(opt => (
                    <button key={opt.v} type="button" onClick={() => setTipoRespuesta(opt.v)}
                      style={{
                        padding: '0.85rem 0.9rem', borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                        border: `2px solid ${tipoRespuesta === opt.v ? '#8b5cf6' : '#e2e8f0'}`,
                        background: tipoRespuesta === opt.v ? '#faf5ff' : 'white', transition: 'all 0.2s',
                      }}>
                      <div style={{ fontSize: '1.3rem', marginBottom: '3px' }}>{opt.e}</div>
                      <div style={{ fontSize: '0.78rem', fontWeight: '800', color: tipoRespuesta === opt.v ? '#7c3aed' : '#1e293b' }}>{opt.t}</div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>{opt.s}</div>
                    </button>
                  ))}
                </div>

                {/* Smart suggestions based on bizType + area */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
                    💡 Sugerencias para {areaName || 'tu área'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {getSmartSuggestions(bizType, areaName).map((s, i) => (
                      <button key={i} type="button"
                        onClick={() => { setQuestionText(s.t); setTipoRespuesta(s.tipo); }}
                        style={{
                          padding: '0.65rem 1rem', borderRadius: '12px', textAlign: 'left', cursor: 'pointer',
                          border: `1.5px solid ${questionText === s.t ? '#8b5cf6' : '#e2e8f0'}`,
                          background: questionText === s.t ? '#faf5ff' : 'white', transition: 'all 0.15s',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                        }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: '600', color: questionText === s.t ? '#7c3aed' : '#1e293b' }}>{s.t}</span>
                        <span style={{ fontSize: '0.62rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{TIPO_LABELS[s.tipo]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <label style={LS}>O escribe la tuya *</label>
                <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                  <input type="text" value={questionText} onChange={e => setQuestionText(e.target.value)}
                    placeholder="ej. ¿Cómo calificarías tu visita hoy?"
                    style={{ ...IS(!!questionText), paddingRight: '3rem', marginBottom: 0 }} />
                  {questionText.trim().length > 4 && (
                    <button
                      type="button"
                      title="Mejorar con IA"
                      disabled={improving}
                      onClick={async () => {
                        setImproving(true);
                        try {
                          // Try edge function first (only if deployed); fallback to local
                          let improved = null;
                          try {
                            const { data, error } = await supabase.functions.invoke('improve-question', {
                              body: { question: questionText, bizType, areaName },
                            });
                            if (!error && data?.improved) improved = data.improved;
                          } catch (_) {}
                          // Local smart improvement as fallback
                          setQuestionText(improved || improveQuestion(questionText, bizType, areaName));
                        } catch (_) {}
                        setImproving(false);
                      }}
                      style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        background: improving ? '#e2e8f0' : 'linear-gradient(135deg,#7C3AED,#0EA5E9)',
                        border: 'none', borderRadius: '8px', width: '30px', height: '30px',
                        cursor: improving ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: improving ? '0.7rem' : '1rem',
                        transition: 'all 0.2s',
                      }}>
                      {improving ? '⏳' : '✨'}
                    </button>
                  )}
                </div>

                {/* Live preview */}
                <div style={{ background: '#f1f5f9', borderRadius: '16px', padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem', textAlign: 'center' }}>Preview del formulario</div>
                  <PhonePreview question={questionText} tipo={tipoRespuesta} logoUrl={logoPreview} />
                </div>

                {error && <ErrBox msg={error} />}
              </div>
            )}

            {/* ── Step 4: Recuperación ── */}
            {step === 4 && (
              <div>
                <SectionHead title="Activa la recuperación de clientes" sub="Datos que mueven la aguja: ticket promedio e identidad para WhatsApp." />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  <div>
                    <label style={LS}>Ticket promedio (MXN) <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#94a3b8', textTransform: 'none' }}>— para calcular recuperación</span></label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', color: '#94a3b8', fontSize: '0.95rem' }}>$</span>
                      <input type="number" min="0" value={avgTicket} onChange={e => setAvgTicket(e.target.value)}
                        placeholder="350" style={{ ...IS(!!avgTicket), paddingLeft: '2rem' }} />
                    </div>
                    {avgTicket && (
                      <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: '700', marginTop: '5px' }}>
                        💡 Si recuperas 10 clientes/mes = ${(parseFloat(avgTicket) * 10).toLocaleString()} MXN adicionales
                      </div>
                    )}
                  </div>

                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>Tu identidad para mensajes WhatsApp</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                      <div>
                        <label style={LS}>Tu nombre</label>
                        <input type="text" value={senderName} onChange={e => setSenderName(e.target.value)}
                          placeholder="ej. Jorge Espíndola" style={IS(!!senderName)} />
                      </div>
                      <div>
                        <label style={LS}>Tu cargo</label>
                        <input type="text" value={senderRole} onChange={e => setSenderRole(e.target.value)}
                          placeholder="ej. Director de Servicio a Clientes" style={IS(!!senderRole)} />
                      </div>
                    </div>
                    {senderName && senderRole && (
                      <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '0.75rem', marginTop: '0.75rem', fontSize: '0.72rem', color: '#065f46', lineHeight: 1.5 }}>
                        👋 Hola, soy <strong>{senderName}</strong>, {senderRole}.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 5: Plan ── */}
            {step === 5 && (
              <div>
                <SectionHead title="Elige tu plan y lanza" sub="Empieza gratis. Cancela cuando quieras." />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {WIZARD_PLANS.map(plan => {
                    const active = selectedPlan === plan.slug;
                    return (
                      <button key={plan.slug} type="button" onClick={() => setSelectedPlan(plan.slug)}
                        style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.1rem', borderRadius: '14px', cursor: 'pointer', border: `2px solid ${active ? plan.color : '#e2e8f0'}`, background: active ? `${plan.color}12` : 'white', textAlign: 'left', transition: 'all 0.2s' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `2px solid ${active ? plan.color : '#cbd5e1'}`, background: active ? plan.color : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: active ? plan.color : '#1e293b' }}>{plan.label}</span>
                            {plan.slug === 'trial' && <span style={{ fontSize: '0.62rem', fontWeight: '800', background: '#D1FAE5', color: '#065F46', borderRadius: 999, padding: '2px 7px' }}>RECOMENDADO</span>}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>{plan.features.join(' · ')}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '1.05rem', fontWeight: '900', color: active ? plan.color : '#1e293b' }}>
                            {plan.price}<span style={{ fontSize: '0.68rem', fontWeight: 400, color: '#94a3b8' }}>{plan.period}</span>
                          </div>
                          <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{plan.note}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* QR preview */}
                {savedStoreId && (
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>Tu primer QR está listo</div>
                    <QRCodeSVG value={qrUrl} size={100} style={{ borderRadius: '8px' }} />
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '8px' }}>Escanéalo para probar tu formulario</div>
                  </div>
                )}

                {error && <ErrBox msg={error} />}
              </div>
            )}

            {/* ── Navigation ── */}
            <button
              disabled={saving || !canProceed}
              onClick={handleNext}
              style={{
                marginTop: '2rem', width: '100%', padding: '1rem 2rem', borderRadius: '16px', border: 'none',
                cursor: saving || !canProceed ? 'not-allowed' : 'pointer',
                background: saving || !canProceed ? '#e2e8f0' : meta.color,
                color: saving || !canProceed ? '#94a3b8' : 'white',
                fontSize: '1rem', fontWeight: '800', fontFamily: "'Plus Jakarta Sans',system-ui",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: saving || !canProceed ? 'none' : `0 8px 24px ${meta.color}40`,
                transition: 'all 0.2s',
              }}>
              {saving ? 'Guardando…' : step === 5 ? '🚀 Activar y ver mi QR' : 'Continuar'}
              {!saving && step < 5 && <ArrowRight size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHead = ({ title, sub }) => (
  <div style={{ marginBottom: '1.75rem' }}>
    <h1 style={{ fontFamily: "'Plus Jakarta Sans',system-ui", fontSize: '1.9rem', fontWeight: '900', color: '#0D0D12', margin: '0 0 0.4rem', letterSpacing: '-0.03em' }}>{title}</h1>
    <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>{sub}</p>
  </div>
);

// ─── Shared micro-styles ──────────────────────────────────────────────────────
const LS = {
  fontSize: '0.72rem', fontWeight: '800', color: '#374151',
  marginBottom: '6px', display: 'block',
  textTransform: 'uppercase', letterSpacing: '0.06em',
};
const IS = (active) => ({
  width: '100%', padding: '0.9rem 1.1rem', borderRadius: '14px',
  border: `2px solid ${active ? '#FF5C3A' : '#e2e8f0'}`,
  fontSize: '0.95rem', fontWeight: '600', outline: 'none',
  transition: 'border-color 0.2s', boxSizing: 'border-box',
  background: active ? '#f0f7ff' : '#fafafa',
});

const ErrBox = ({ msg, onClearSession, onSignOut }) => (
  <div style={{ marginTop: '1rem' }}>
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', gap: '10px', alignItems: 'center', color: '#dc2626', marginBottom: onClearSession ? '0.75rem' : 0 }}>
      <Zap size={18} />
      <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{msg}</span>
    </div>
    {onClearSession && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
        <button onClick={onClearSession} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', background: '#FF5C3A', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem' }}>
          Limpiar sesión y reintentar
        </button>
        <button onClick={onSignOut} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', background: 'white', color: '#dc2626', border: '2px solid #dc2626', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem' }}>
          Borrón y Cuenta Nueva (Limpieza Total)
        </button>
      </div>
    )}
  </div>
);

export default OnboardingWizard;
