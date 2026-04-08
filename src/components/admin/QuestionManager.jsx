import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../hooks/useTenant';
import {
  Save, Loader, CheckCircle2, AlertCircle, Eye, EyeOff,
  MessageSquare, User, Clock, ShoppingBag, Calendar, Megaphone, MapPin,
  ChevronRight, Plus, Trash2, ToggleLeft, ToggleRight, Smile
} from 'lucide-react';

const T = {
  coral:'#FF5C3A', teal:'#00C9A7', purple:'#7C3AED', ink:'#0D0D12',
  muted:'#6B7280', border:'#E5E7EB', bg:'#F7F8FC', card:'#FFFFFF',
  green:'#16A34A', amber:'#F59E0B', red:'#DC2626',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const QR_TYPES = [
  { value: 'area',     label: 'Área / Mesa',  Icon: MapPin,       color: T.teal,   desc: 'Mesas, secciones del local, mostrador' },
  { value: 'employee', label: 'Empleado',      Icon: User,         color: T.purple, desc: 'Desempeño individual de cada empleado' },
  { value: 'shift',    label: 'Turno',         Icon: Clock,        color: T.coral,  desc: 'Mañana, tarde, noche' },
  { value: 'product',  label: 'Producto',      Icon: ShoppingBag,  color: T.amber,  desc: 'Artículos o platillos específicos' },
  { value: 'event',    label: 'Evento',        Icon: Calendar,     color: '#EC4899', desc: 'Eventos temporales o especiales' },
  { value: 'channel',  label: 'Canal',         Icon: Megaphone,    color: '#06B6D4', desc: 'Delivery, drive-thru, en línea' },
];

const DEFAULT_CONFIG = {
  main_question: '¿Cómo fue tu experiencia hoy?',
  rating_style: 'emoji',
  negative_threshold: 2,
  followup_enabled: true,
  followup_type: 'multiple_choice',
  followup_question: '¿Qué podríamos mejorar?',
  followup_options: ['Tiempo de espera', 'Trato del personal', 'Calidad', 'Limpieza', 'Precio', 'Otro'],
  request_contact: true,
};

const TYPE_DEFAULTS = {
  area: {
    main_question: '¿Cómo fue tu experiencia en esta área?',
    followup_options: ['Tiempo de espera', 'Trato del personal', 'Calidad', 'Limpieza', 'Ambiente', 'Otro']
  },
  employee: {
    main_question: '¿Cómo calificas la atención que recibiste?',
    followup_options: ['Amabilidad', 'Rapidez', 'Atención', 'Presentación', 'Conocimiento del menú', 'Otro']
  },
  shift: {
    main_question: '¿Cómo calificas el servicio en este turno?',
    followup_options: ['Limpieza', 'Servicio', 'Disponibilidad de productos', 'Rapidez', 'Otro']
  },
  product: {
    main_question: '¿Qué te pareció nuestro producto?',
    followup_options: ['Sabor', 'Calidad', 'Precio', 'Presentación', 'Temperatura', 'Otro']
  },
  event: {
    main_question: '¿Qué te pareció nuestro evento?',
    followup_options: ['Organización', 'Ambiente', 'Contenido', 'Atención del personal', 'Lugar', 'Otro']
  },
  channel: {
    main_question: '¿Cómo fue tu experiencia en este canal?',
    followup_options: ['Tiempo de entrega', 'Estado del pedido', 'Facilidad de pedido', 'Atención telefónica', 'Otro']
  }
};

const RATING_STYLES = [
  { value: 'emoji',  label: 'Emojis 😤😕😐😊🤩',  desc: 'Caras expresivas 1-5' },
  { value: 'stars',  label: 'Estrellas ⭐⭐⭐⭐⭐', desc: 'Clásico 1-5 estrellas' },
  { value: 'nps',    label: 'NPS 0-10',             desc: 'Net Promoter Score' },
];

// ─── Mini phone preview ───────────────────────────────────────────────────────
function PhonePreview({ config, typeName }) {
  const EMOJIS  = ['😤', '😕', '😐', '😊', '🤩'];
  const [score, setScore] = useState(0);
  const showFollowup = config.followup_enabled && score > 0 && score <= config.negative_threshold;

  return (
    <div style={{ background: T.ink, borderRadius: 28, padding: '28px 18px', width: 240, margin: '0 auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
      {/* Notch */}
      <div style={{ width: 60, height: 6, background: '#333', borderRadius: 3, margin: '0 auto 20px' }} />

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: 18, padding: '20px 16px', textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, width: 14, height: 14 }}>
            {[T.coral, T.teal, T.teal, T.coral].map((c, i) => (
              <div key={i} style={{ background: c, borderRadius: 1 }} />
            ))}
          </div>
          <span style={{ fontWeight: 800, fontSize: '0.8rem', color: T.ink }}>retelio</span>
        </div>

        <div style={{ fontSize: '0.65rem', color: T.muted, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{typeName}</div>
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: T.ink, marginBottom: 14, lineHeight: 1.3 }}>
          {config.main_question || '¿Cómo fue tu experiencia?'}
        </div>

        {/* Rating */}
        {config.rating_style === 'emoji' && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
            {EMOJIS.map((e, i) => (
              <span key={i} onClick={() => setScore(i + 1)} style={{ fontSize: '1.3rem', cursor: 'pointer', opacity: score === 0 || score === i + 1 ? 1 : 0.3 }}>{e}</span>
            ))}
          </div>
        )}
        {config.rating_style === 'stars' && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 12 }}>
            {[1,2,3,4,5].map(n => (
              <span key={n} onClick={() => setScore(n)} style={{ fontSize: '1.5rem', cursor: 'pointer', opacity: score >= n ? 1 : 0.25 }}>⭐</span>
            ))}
          </div>
        )}
        {config.rating_style === 'nps' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', marginBottom: 12 }}>
            {[...Array(11)].map((_, i) => (
              <div key={i} onClick={() => setScore(i)} style={{ width: 26, height: 26, borderRadius: 6, background: score === i ? T.coral : '#F1F5F9', color: score === i ? '#fff' : T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>{i}</div>
            ))}
          </div>
        )}

        {/* Follow-up */}
        {showFollowup && (
          <div style={{ background: '#FFF1EE', borderRadius: 10, padding: '10px 12px', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.ink, marginBottom: 8 }}>{config.followup_question}</div>
            {config.followup_type === 'multiple_choice' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(config.followup_options || []).slice(0, 3).map((opt, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: '0.65rem', color: T.muted, border: `1px solid ${T.border}` }}>{opt}</div>
                ))}
                {config.followup_options?.length > 3 && <div style={{ fontSize: '0.6rem', color: T.muted }}>+{config.followup_options.length - 3} más…</div>}
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 6, padding: '6px 8px', fontSize: '0.65rem', color: '#CBD5E1', border: `1px solid ${T.border}` }}>Escribe tu comentario…</div>
            )}
          </div>
        )}

        {score === 0 && (
          <div style={{ fontSize: '0.65rem', color: T.muted, marginTop: 4 }}>Toca para previsualizar →</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function QuestionManager() {
  const { tenant } = useTenant();
  const [configs, setConfigs]     = useState({}); // { qr_type: config }
  const [selected, setSelected]   = useState('area');
  const [form, setForm]           = useState(null);
  const [newOption, setNewOption] = useState('');
  const [saving, setSaving]       = useState(false);
  const [message, setMessage]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [preview, setPreview]     = useState(true);

  useEffect(() => { if (tenant?.id) loadConfigs(); }, [tenant?.id]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('qr_type_config')
        .select('*')
        .eq('tenant_id', tenant.id);
      if (error) console.warn('qr_type_config:', error.message);
      const map = {};
      (data || []).forEach(r => {
        // ensure followup_options is always an array
        if (typeof r.followup_options === 'string') {
          try { r.followup_options = JSON.parse(r.followup_options); } catch { r.followup_options = []; }
        }
        if (!Array.isArray(r.followup_options)) r.followup_options = [];
        map[r.qr_type] = r;
      });
      setConfigs(map);
      selectType('area', map);
    } catch (e) {
      console.error('loadConfigs error:', e);
    } finally {
      setLoading(false);
    }
  };

  const selectType = (type, map = configs) => {
    setSelected(type);
    const existing = map[type];
    const typeDefault = TYPE_DEFAULTS[type] || {};
    
    setForm(existing
      ? { 
          ...DEFAULT_CONFIG, 
          ...typeDefault, 
          ...existing, 
          followup_options: (existing.followup_options && existing.followup_options.length > 0) 
            ? existing.followup_options 
            : (typeDefault.followup_options || DEFAULT_CONFIG.followup_options) 
        }
      : { ...DEFAULT_CONFIG, ...typeDefault });
  };

  const save = async () => {
    setSaving(true);
    const payload = { ...form, tenant_id: tenant.id, qr_type: selected, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('qr_type_config').upsert(payload, { onConflict: 'tenant_id,qr_type' });
    setSaving(false);
    if (error) { setMessage({ type: 'error', text: error.message }); return; }
    setMessage({ type: 'success', text: 'Configuración guardada.' });
    setTimeout(() => setMessage(null), 3000);
    loadConfigs();
  };

  const addOption = () => {
    if (!newOption.trim()) return;
    setForm(f => ({ ...f, followup_options: [...(f.followup_options || []), newOption.trim()] }));
    setNewOption('');
  };

  const removeOption = (i) => setForm(f => ({ ...f, followup_options: f.followup_options.filter((_, idx) => idx !== i) }));

  const typeInfo = QR_TYPES.find(t => t.value === selected);

  if (loading) return (
    <div style={{ fontFamily: font, padding: 48, textAlign: 'center', color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ fontFamily: font, padding: 28, background: T.bg, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginBottom: 4 }}>Preguntas por tipo de QR</h1>
        <p style={{ fontSize: '0.85rem', color: T.muted }}>Cada tipo de QR puede tener su propia pregunta, estilo de calificación y seguimiento</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr auto', gap: 20 }}>

        {/* Left: type list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {QR_TYPES.map(({ value, label, Icon, color, desc }) => {
            const hasConfig = !!configs[value];
            return (
              <button key={value} onClick={() => selectType(value)} style={{
                padding: '12px 14px', borderRadius: 14, border: `2px solid ${selected === value ? color : T.border}`,
                background: selected === value ? color + '10' : T.card, cursor: 'pointer', textAlign: 'left',
                fontFamily: font, transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Icon size={15} color={selected === value ? color : T.muted} />
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: selected === value ? color : T.ink }}>{label}</span>
                  {hasConfig && <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, marginLeft: 'auto' }} />}
                </div>
                <div style={{ fontSize: '0.7rem', color: T.muted, lineHeight: 1.3 }}>{desc}</div>
              </button>
            );
          })}
        </div>

        {/* Center: form */}
        {form && (
          <div style={{ background: T.card, borderRadius: 20, border: `1.5px solid ${typeInfo?.color || T.border}30`, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {typeInfo && <typeInfo.Icon size={18} color={typeInfo.color} />}
              <h2 style={{ fontWeight: 800, color: T.ink, fontSize: '1rem' }}>{typeInfo?.label}</h2>
            </div>

            {message && (
              <div style={{ padding: '10px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, background: message.type === 'success' ? '#DCFCE7' : '#FEE2E2', color: message.type === 'success' ? T.green : T.red, fontSize: '0.85rem', fontWeight: 600 }}>
                {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {message.text}
              </div>
            )}

            {/* Main question */}
            <div>
              <Label>Pregunta principal</Label>
              <input value={form.main_question} onChange={e => setForm(f => ({ ...f, main_question: e.target.value }))}
                placeholder="¿Cómo fue tu experiencia hoy?"
                style={inputStyle} />
              <Hint>{'Para empleados usa: "¿Cómo fue la atención de {{nombre}}?"'}</Hint>
            </div>

            {/* Rating style */}
            <div>
              <Label>Estilo de calificación</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {RATING_STYLES.map(({ value, label, desc }) => (
                  <button key={value} onClick={() => setForm(f => ({ ...f, rating_style: value }))} style={{
                    flex: 1, padding: '10px 8px', borderRadius: 12, border: `2px solid ${form.rating_style === value ? T.coral : T.border}`,
                    background: form.rating_style === value ? T.coral + '10' : '#fff', cursor: 'pointer',
                    fontFamily: font, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: form.rating_style === value ? T.coral : T.ink }}>{label}</div>
                    <div style={{ fontSize: '0.68rem', color: T.muted }}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Negative threshold */}
            <div>
              <Label>Mostrar seguimiento si la calificación es ≤</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1,2,3].map(n => (
                  <button key={n} onClick={() => setForm(f => ({ ...f, negative_threshold: n }))} style={{
                    width: 44, height: 44, borderRadius: 12, border: `2px solid ${form.negative_threshold === n ? T.coral : T.border}`,
                    background: form.negative_threshold === n ? T.coral : '#fff', color: form.negative_threshold === n ? '#fff' : T.muted,
                    fontWeight: 800, fontSize: '1rem', cursor: 'pointer', fontFamily: font,
                  }}>{n}</button>
                ))}
                <span style={{ fontSize: '0.82rem', color: T.muted, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                  {form.rating_style === 'nps' ? '(0-10)' : '(de 5)'}
                </span>
              </div>
            </div>

            {/* Follow-up toggle */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Label style={{ margin: 0 }}>Pregunta de seguimiento (negativo)</Label>
                <button onClick={() => setForm(f => ({ ...f, followup_enabled: !f.followup_enabled }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: form.followup_enabled ? T.teal : T.muted }}>
                  {form.followup_enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>

              {form.followup_enabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px', background: '#F8F9FC', borderRadius: 14, border: `1px solid ${T.border}` }}>
                  {/* Follow-up type */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[{ value: 'multiple_choice', label: 'Opción múltiple' }, { value: 'open_text', label: 'Texto abierto' }].map(({ value, label }) => (
                      <button key={value} onClick={() => setForm(f => ({ ...f, followup_type: value }))} style={{
                        flex: 1, padding: '8px', borderRadius: 10, border: `2px solid ${form.followup_type === value ? T.teal : T.border}`,
                        background: form.followup_type === value ? T.teal + '10' : '#fff', cursor: 'pointer',
                        fontWeight: 700, fontSize: '0.8rem', color: form.followup_type === value ? T.teal : T.muted, fontFamily: font,
                      }}>{label}</button>
                    ))}
                  </div>

                  <div>
                    <Label>Pregunta de seguimiento</Label>
                    <input value={form.followup_question} onChange={e => setForm(f => ({ ...f, followup_question: e.target.value }))}
                      style={inputStyle} />
                  </div>

                  {form.followup_type === 'multiple_choice' && (
                    <div>
                      <Label>Opciones de respuesta</Label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                        {(form.followup_options || []).map((opt, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 8, padding: '7px 12px', border: `1px solid ${T.border}` }}>
                            <span style={{ flex: 1, fontSize: '0.85rem', color: T.ink }}>{opt}</span>
                            <button onClick={() => removeOption(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input value={newOption} onChange={e => setNewOption(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addOption()}
                          placeholder="Nueva opción…"
                          style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
                        <button onClick={addOption} style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: T.teal, color: '#fff', cursor: 'pointer' }}>
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Request contact */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F8F9FC', borderRadius: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: T.ink }}>Solicitar contacto si calificación negativa</div>
                <div style={{ fontSize: '0.75rem', color: T.muted }}>Pide número de WhatsApp para dar seguimiento</div>
              </div>
              <button onClick={() => setForm(f => ({ ...f, request_contact: !f.request_contact }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: form.request_contact ? T.teal : T.muted }}>
                {form.request_contact ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>

            {/* Save */}
            <button onClick={save} disabled={saving} style={{
              padding: '12px 24px', borderRadius: 14, border: 'none',
              background: saving ? T.muted : T.coral, color: '#fff',
              fontWeight: 700, fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {saving ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : <><Save size={16} /> Guardar configuración</>}
            </button>
          </div>
        )}

        {/* Right: preview */}
        <div style={{ width: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Preview</span>
            <button onClick={() => setPreview(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}>
              {preview ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {preview && form && (
            <PhonePreview config={form} typeName={typeInfo?.label || ''} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: `1.5px solid #E5E7EB`, fontSize: '0.88rem',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  color: '#0D0D12', outline: 'none', boxSizing: 'border-box',
  marginBottom: 0,
};

function Label({ children, style }) {
  return <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0D0D12', marginBottom: 6, ...style }}>{children}</div>;
}
function Hint({ children }) {
  return <div style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: 4 }}>{children}</div>;
}
