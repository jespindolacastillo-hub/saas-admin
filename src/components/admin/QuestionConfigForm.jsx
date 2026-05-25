import React, { useState } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from 'lucide-react';

const T = {
  coral: '#FF5C3A', teal: '#00C9A7', ink: '#0D0D12',
  muted: '#6B7280', border: '#E5E7EB', red: '#DC2626',
};
const font = "'Plus Jakarta Sans', system-ui, sans-serif";

export const QUESTION_DEFAULT_CONFIG = {
  main_question: '¿Cómo fue tu experiencia hoy?',
  rating_style: 'emoji',
  negative_threshold: 2,
  followup_enabled: true,
  followup_type: 'multiple_choice',
  followup_question: '¿Qué podríamos mejorar?',
  followup_options: ['Tiempo de espera', 'Trato del personal', 'Calidad', 'Limpieza', 'Precio', 'Otro'],
  request_contact: true,
};

export const QUESTION_TYPE_DEFAULTS = {
  area:     { main_question: '¿Cómo fue tu experiencia en esta área?',    followup_options: ['Tiempo de espera', 'Trato del personal', 'Calidad', 'Limpieza', 'Ambiente', 'Otro'] },
  employee: { main_question: '¿Cómo calificas la atención que recibiste?', followup_options: ['Amabilidad', 'Rapidez', 'Atención', 'Presentación', 'Conocimiento del menú', 'Otro'] },
  shift:    { main_question: '¿Cómo calificas el servicio en este turno?',  followup_options: ['Limpieza', 'Servicio', 'Disponibilidad de productos', 'Rapidez', 'Otro'] },
  product:  { main_question: '¿Qué te pareció nuestro producto?',           followup_options: ['Sabor', 'Calidad', 'Precio', 'Presentación', 'Temperatura', 'Otro'] },
  event:    { main_question: '¿Qué te pareció nuestro evento?',             followup_options: ['Organización', 'Ambiente', 'Contenido', 'Atención del personal', 'Lugar', 'Otro'] },
  channel:  { main_question: '¿Cómo fue tu experiencia en este canal?',     followup_options: ['Tiempo de entrega', 'Estado del pedido', 'Facilidad de pedido', 'Atención telefónica', 'Otro'] },
};

const RATING_STYLES = [
  { value: 'emoji', label: 'Emojis 😤🤩' },
  { value: 'stars', label: 'Estrellas ⭐' },
  { value: 'nps',   label: 'NPS 0-10'    },
];

export function getTypeDefault(qrType) {
  return { ...QUESTION_DEFAULT_CONFIG, ...(QUESTION_TYPE_DEFAULTS[qrType] || {}) };
}

const inputSt = {
  width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10,
  padding: '9px 12px', fontFamily: font, fontSize: '0.85rem',
  outline: 'none', boxSizing: 'border-box', background: '#fff', color: T.ink,
};

// value: null = inherit from type default | object = custom per-QR config
// onChange: (newConfig | null) => void
export default function QuestionConfigForm({ value, qrType = 'area', onChange }) {
  const [expanded, setExpanded] = useState(!!value);
  const [newOption, setNewOption] = useState('');

  const isCustom = value !== null && value !== undefined;
  const form = isCustom ? value : getTypeDefault(qrType);

  const setForm = (updater) => {
    const next = typeof updater === 'function' ? updater(form) : updater;
    onChange(next);
  };

  const addOption = () => {
    if (!newOption.trim()) return;
    setForm(f => ({ ...f, followup_options: [...(f.followup_options || []), newOption.trim()] }));
    setNewOption('');
  };

  const removeOption = (i) => setForm(f => ({ ...f, followup_options: f.followup_options.filter((_, idx) => idx !== i) }));

  const handleToggleExpand = () => {
    if (!expanded && !isCustom) {
      onChange({ ...getTypeDefault(qrType) });
    }
    setExpanded(v => !v);
  };

  const handleReset = () => {
    onChange(null);
    setExpanded(false);
  };

  return (
    <div style={{ border: `1.5px solid ${isCustom ? T.coral + '50' : T.border}`, borderRadius: 12, overflow: 'hidden' }}>
      {/* Header toggle */}
      <button
        type="button"
        onClick={handleToggleExpand}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 14px', background: isCustom ? T.coral + '08' : '#F8F9FC',
          border: 'none', cursor: 'pointer', fontFamily: font,
        }}
      >
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isCustom ? T.coral : T.ink }}>
            {isCustom ? '⚙ Preguntas personalizadas' : '📋 Preguntas: heredando plantilla del tipo'}
          </div>
          {!isCustom && (
            <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: 2 }}>
              Clic para configurar preguntas independientes para este QR
            </div>
          )}
        </div>
        {expanded ? <ChevronUp size={15} color={T.muted} /> : <ChevronDown size={15} color={T.muted} />}
      </button>

      {/* Form body */}
      {expanded && (
        <div style={{ padding: '14px 16px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 14, borderTop: `1px solid ${T.border}` }}>
          {/* Reset banner */}
          {isCustom && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 11px', background: T.coral + '08', borderRadius: 8, border: `1px solid ${T.coral}25` }}>
              <span style={{ fontSize: '0.72rem', color: T.coral, fontWeight: 600 }}>Configuración propia · independiente del tipo</span>
              <button type="button" onClick={handleReset} style={{ fontSize: '0.7rem', color: T.muted, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: font, textDecoration: 'underline' }}>
                Restablecer a plantilla
              </button>
            </div>
          )}

          {/* Main question */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.ink, marginBottom: 5 }}>Pregunta principal</div>
            <input style={inputSt} value={form.main_question}
              onChange={e => setForm(f => ({ ...f, main_question: e.target.value }))} />
          </div>

          {/* Rating style */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.ink, marginBottom: 5 }}>Estilo de calificación</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {RATING_STYLES.map(({ value: v, label }) => (
                <button key={v} type="button" onClick={() => setForm(f => ({ ...f, rating_style: v }))} style={{
                  flex: 1, padding: '7px 6px', borderRadius: 9,
                  border: `2px solid ${form.rating_style === v ? T.coral : T.border}`,
                  background: form.rating_style === v ? T.coral + '10' : '#fff',
                  cursor: 'pointer', fontFamily: font,
                  fontSize: '0.72rem', fontWeight: 700, color: form.rating_style === v ? T.coral : T.ink,
                }}>{label}</button>
              ))}
            </div>
          </div>

          {/* Negative threshold */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.ink, marginBottom: 5 }}>
              Mostrar seguimiento si calificación ≤
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[1, 2, 3].map(n => (
                <button key={n} type="button" onClick={() => setForm(f => ({ ...f, negative_threshold: n }))} style={{
                  width: 38, height: 38, borderRadius: 10,
                  border: `2px solid ${form.negative_threshold === n ? T.coral : T.border}`,
                  background: form.negative_threshold === n ? T.coral : '#fff',
                  color: form.negative_threshold === n ? '#fff' : T.muted,
                  fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', fontFamily: font,
                }}>{n}</button>
              ))}
              <span style={{ fontSize: '0.75rem', color: T.muted, paddingLeft: 4 }}>
                {form.rating_style === 'nps' ? '(0–10)' : '(de 5)'}
              </span>
            </div>
          </div>

          {/* Followup toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.ink }}>Pregunta de seguimiento (negativo)</div>
            <button type="button" onClick={() => setForm(f => ({ ...f, followup_enabled: !f.followup_enabled }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: form.followup_enabled ? T.teal : T.muted }}>
              {form.followup_enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
            </button>
          </div>

          {form.followup_enabled && (
            <div style={{ padding: '12px', background: '#F8F9FC', borderRadius: 10, border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Type toggle */}
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ value: 'multiple_choice', label: 'Opción múltiple' }, { value: 'open_text', label: 'Texto abierto' }].map(({ value: v, label }) => (
                  <button key={v} type="button" onClick={() => setForm(f => ({ ...f, followup_type: v }))} style={{
                    flex: 1, padding: '7px', borderRadius: 9,
                    border: `2px solid ${form.followup_type === v ? T.teal : T.border}`,
                    background: form.followup_type === v ? T.teal + '10' : '#fff',
                    cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem',
                    color: form.followup_type === v ? T.teal : T.muted, fontFamily: font,
                  }}>{label}</button>
                ))}
              </div>

              <input style={inputSt} placeholder="¿Qué podríamos mejorar?"
                value={form.followup_question}
                onChange={e => setForm(f => ({ ...f, followup_question: e.target.value }))} />

              {form.followup_type === 'multiple_choice' && (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                    {(form.followup_options || []).map((opt, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 7, padding: '5px 10px', border: `1px solid ${T.border}` }}>
                        <span style={{ flex: 1, fontSize: '0.82rem', color: T.ink }}>{opt}</span>
                        <button type="button" onClick={() => removeOption(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input style={{ ...inputSt, flex: 1 }} value={newOption}
                      onChange={e => setNewOption(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                      placeholder="Nueva opción…" />
                    <button type="button" onClick={addOption} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: T.teal, color: '#fff', cursor: 'pointer' }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Request contact */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#F8F9FC', borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: T.ink }}>Solicitar contacto si calificación negativa</div>
              <div style={{ fontSize: '0.68rem', color: T.muted }}>Pide WhatsApp o correo para dar seguimiento</div>
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, request_contact: !f.request_contact }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: form.request_contact ? T.teal : T.muted }}>
              {form.request_contact ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
