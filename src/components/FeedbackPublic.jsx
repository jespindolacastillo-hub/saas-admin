import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ─── Sentiment thresholds ─────────────────────────────────────────────────────
const getIsUnhappy = (s, style = 'emoji', threshold = 2) => {
  if (style === 'nps') return s <= 6;
  return s <= threshold;
};

const getIsHappy   = (s, style = 'emoji') => {
  if (style === 'nps') return s >= 9;
  return s >= 4;
};

// ─── Device fingerprint for cooldown ─────────────────────────────────────────
const getDeviceHash = () => {
  const parts = [navigator.userAgent, navigator.language, screen.width + 'x' + screen.height, new Date().getTimezoneOffset()].join('|');
  let h = 0;
  for (let i = 0; i < parts.length; i++) h = Math.imul(31, h) + parts.charCodeAt(i) | 0;
  return 'dv_' + Math.abs(h).toString(16);
};

// ─── Coupon generator ─────────────────────────────────────────────────────────
const genCode = (prefix = 'RECOVERY') => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${code}`;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────
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
  area: { rating_style: 'nps', negative_threshold: 6, followup_options: ['Tiempo de espera', 'Trato del personal', 'Calidad', 'Limpieza', 'Ambiente', 'Otro'] },
  employee: { rating_style: 'nps', negative_threshold: 6, followup_options: ['Amabilidad', 'Rapidez', 'Atención', 'Presentación', 'Conocimiento del menú', 'Otro'] },
  shift: { rating_style: 'nps', negative_threshold: 6, followup_options: ['Limpieza', 'Servicio', 'Disponibilidad de productos', 'Rapidez', 'Otro'] },
  product: { rating_style: 'nps', negative_threshold: 6, followup_options: ['Sabor', 'Calidad', 'Precio', 'Presentación', 'Temperatura', 'Otro'] },
  event: { rating_style: 'nps', negative_threshold: 6, followup_options: ['Organización', 'Ambiente', 'Contenido', 'Atención del personal', 'Lugar', 'Otro'] },
  channel: { rating_style: 'nps', negative_threshold: 6, followup_options: ['Tiempo de entrega', 'Estado del pedido', 'Facilidad de pedido', 'Atención telefónica', 'Otro'] }
};

// ─── Test mode helpers ────────────────────────────────────────────────────────
const TEST_MODE_KEY = 'rf_test_mode';
const isTestMode   = () => localStorage.getItem(TEST_MODE_KEY) === 'on';
const toggleTestMode = () => {
  const next = isTestMode() ? null : 'on';
  next ? localStorage.setItem(TEST_MODE_KEY, 'on') : localStorage.removeItem(TEST_MODE_KEY);
  return !!next;
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const S = {
  coral:  '#FF5C3A',
  teal:   '#00C9A7',
  ink:    '#0D0D12',
  bg:     '#F7F8FC',
  card:   '#FFFFFF',
  muted:  '#6B7280',
  border: '#E5E7EB',
};
const fontStack = "'Plus Jakarta Sans', system-ui, sans-serif";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  .rf * { box-sizing: border-box; margin: 0; padding: 0; }
  .rf {
    font-family: ${fontStack};
    background: ${S.bg};
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .rf-card {
    background: ${S.card};
    border-radius: 24px;
    padding: 36px 28px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 4px 32px rgba(13,13,18,.08);
  }

  /* Logo */
  .rf-logo { display: flex; align-items: center; gap: 8px; margin-bottom: 28px; }
  .rf-logo-dots { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; width: 20px; height: 20px; }
  .rf-logo-dot  { border-radius: 2px; }
  .rf-logo-word { font-size: 1.05rem; font-weight: 800; color: ${S.ink}; letter-spacing: -0.02em; }

  /* Progress dots */
  .rf-progress { display: flex; gap: 6px; margin-bottom: 28px; }
  .rf-dot { width: 6px; height: 6px; border-radius: 99px; background: ${S.border}; transition: all .25s; }
  .rf-dot.active { width: 20px; background: ${S.coral}; }
  .rf-dot.done   { background: ${S.teal}; }

  /* Step header */
  .rf-step-label { font-size: 0.72rem; font-weight: 700; color: ${S.muted}; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 6px; }
  .rf-step-title { font-size: 1.45rem; font-weight: 800; color: ${S.ink}; line-height: 1.25; margin-bottom: 28px; }

  /* Emoji grid */
  .rf-emojis { display: flex; justify-content: space-between; gap: 4px; margin-bottom: 6px; }
  .rf-emoji-btn {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 14px 6px; border: 2px solid transparent; border-radius: 16px;
    background: transparent; cursor: pointer; transition: all .15s; outline: none;
  }
  .rf-emoji-btn:hover  { background: ${S.bg}; }
  .rf-emoji-btn.active { border-color: ${S.coral}; background: ${S.coral}08; }
  .rf-emoji { font-size: 2.2rem; filter: grayscale(1) opacity(.4); transition: filter .15s, transform .15s; }
  .rf-emoji-btn.active .rf-emoji, .rf-emoji-btn:hover .rf-emoji { filter: none; transform: scale(1.15); }
  .rf-emoji-label { font-size: 0.65rem; font-weight: 600; color: ${S.muted}; text-align: center; line-height: 1.2; }
  .rf-emoji-btn.active .rf-emoji-label { color: ${S.coral}; }

  /* Category chips */
  .rf-chips { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
  .rf-chip {
    padding: 13px 16px; border: 2px solid ${S.border}; border-radius: 12px;
    background: #fff; font-family: ${fontStack}; font-size: 0.9rem; font-weight: 600;
    color: ${S.ink}; cursor: pointer; text-align: left; transition: all .15s; outline: none;
  }
  .rf-chip:hover  { border-color: ${S.coral}; background: ${S.coral}06; }
  .rf-chip.active { border-color: ${S.coral}; background: ${S.coral}10; color: ${S.coral}; }

  /* Textarea */
  .rf-textarea {
    width: 100%; border: 1.5px solid ${S.border}; border-radius: 12px;
    padding: 12px 14px; font-family: ${fontStack}; font-size: 0.95rem; resize: none;
    outline: none; transition: border-color .2s; margin-bottom: 20px;
  }
  .rf-textarea:focus { border-color: ${S.coral}; }

  /* Input */
  .rf-input {
    width: 100%; border: 1.5px solid ${S.border}; border-radius: 12px;
    padding: 14px 16px; font-family: ${fontStack}; font-size: 1rem;
    outline: none; transition: border-color .2s; margin-bottom: 12px;
    color: ${S.ink};
  }
  .rf-input:focus { border-color: ${S.teal}; }

  /* Buttons */
  .rf-btn {
    width: 100%; padding: 15px; border: none; border-radius: 14px;
    font-family: ${fontStack}; font-size: 1rem; font-weight: 700; cursor: pointer;
    transition: opacity .15s, transform .1s;
  }
  .rf-btn:disabled { opacity: .45; cursor: not-allowed; }
  .rf-btn:not(:disabled):active { transform: scale(.98); }
  .rf-btn-primary { background: ${S.coral}; color: #fff; }
  .rf-btn-teal    { background: ${S.teal};  color: #fff; }
  .rf-btn-ghost   {
    background: transparent; color: ${S.muted};
    font-size: 0.88rem; font-weight: 600; padding: 10px;
    text-decoration: underline; text-decoration-color: transparent;
  }
  .rf-btn-ghost:hover { color: ${S.ink}; }

  /* State screens */
  .rf-state { text-align: center; }
  .rf-state-icon  { font-size: 3.5rem; margin-bottom: 16px; }
  .rf-state-title { font-size: 1.4rem; font-weight: 800; color: ${S.ink}; margin-bottom: 8px; }
  .rf-state-desc  { font-size: 0.95rem; color: ${S.muted}; line-height: 1.6; margin-bottom: 28px; }

  .rf-powered { text-align: center; font-size: 0.68rem; color: #CBD5E1; margin-top: 24px; }

  /* Coupon */
  .rf-coupon {
    border-radius: 16px; padding: 20px; margin-bottom: 20px; text-align: center;
    background: linear-gradient(135deg, #0D0D12 0%, #1a0f0a 100%);
    box-shadow: 0 8px 28px ${S.coral}30;
  }
  .rf-coupon-label { font-size: 0.65rem; font-weight: 800; color: ${S.teal}; text-transform: uppercase; letter-spacing: .15em; margin-bottom: 8px; }
  .rf-coupon-code  { font-size: 1.9rem; font-weight: 800; color: #fff; letter-spacing: .08em; font-family: monospace; margin-bottom: 6px; }
  .rf-coupon-desc  { font-size: 0.85rem; color: rgba(255,255,255,.7); }

  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .rf-card { animation: fadeSlide .25s ease; }
`;

const EMOJIS = [
  { value: 1, emoji: '😤', label: 'Muy malo' },
  { value: 2, emoji: '😕', label: 'Malo' },
  { value: 3, emoji: '😐', label: 'Regular' },
  { value: 4, emoji: '😊', label: 'Bueno' },
  { value: 5, emoji: '🤩', label: '¡Excelente!' },
];

const DEFAULT_OPTIONS = ['Tiempo de espera', 'Trato del personal', 'Calidad', 'Limpieza', 'Precio', 'Otro'];

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ onSecretTap }) {
  const [taps, setTaps] = useState(0);
  const handleTap = () => {
    if (!onSecretTap) return;
    const next = taps + 1;
    setTaps(next);
    if (next >= 5) { setTaps(0); onSecretTap(); }
  };
  return (
    <div className="rf-logo" onClick={handleTap}>
      <div className="rf-logo-dots">
        {[S.coral, S.teal, S.teal, S.coral].map((c, i) => (
          <div key={i} className="rf-logo-dot" style={{ background: c }} />
        ))}
      </div>
      <span className="rf-logo-word">retelio</span>
    </div>
  );
}

// ─── Progress dots ────────────────────────────────────────────────────────────
function Progress({ total, current }) {
  return (
    <div className="rf-progress">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`rf-dot ${i === current ? 'active' : i < current ? 'done' : ''}`} />
      ))}
    </div>
  );
}

// ─── Step 1: Score ────────────────────────────────────────────────────────────
function StepScore({ locationName, qrLabel, testMode, onSecretTap, onSelect, config }) {
  const label = [locationName, qrLabel].filter(Boolean).join(' · ');
  const style = config?.rating_style || 'emoji';
  const mainQuestion = config?.main_question || '¿Cómo fue tu experiencia hoy?';

  const [localScore, setLocalScore] = useState(0);

  return (
    <div className="rf-card">
      <Logo onSecretTap={onSecretTap} />
      {testMode && (
        <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, padding: '4px 10px', fontSize: '0.7rem', fontWeight: 700, color: '#92400e', marginBottom: 14, textAlign: 'center' }}>
          🧪 MODO PRUEBA · toca el logo 5× para apagar
        </div>
      )}
      {label && <div style={{ fontSize: '0.72rem', fontWeight: 600, color: S.muted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{label}</div>}
      <h1 className="rf-step-title">{mainQuestion}</h1>

      {style === 'emoji' && (
        <div className="rf-emojis">
          {EMOJIS.map(({ value, emoji, label: lbl }) => (
            <button key={value} className="rf-emoji-btn" onClick={() => onSelect(value)}>
              <span className="rf-emoji">{emoji}</span>
              <span className="rf-emoji-label">{lbl}</span>
            </button>
          ))}
        </div>
      )}

      {style === 'stars' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '28px' }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => onSelect(n)} onMouseEnter={() => setLocalScore(n)} onMouseLeave={() => setLocalScore(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', outline: 'none', transition: 'transform 0.1s' }}>
              <span style={{ fontSize: '2.8rem', color: (localScore || 0) >= n ? '#F59E0B' : '#E5E7EB', textShadow: (localScore || 0) >= n ? '0 0 10px rgba(245, 158, 11, 0.3)' : 'none' }}>⭐</span>
            </button>
          ))}
        </div>
      )}

      {style === 'nps' && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginBottom: '6px' }}>
            {[0, 1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => onSelect(n)} style={{ height: '44px', borderRadius: '10px', border: `2.5px solid ${S.border}`, background: '#fff', fontWeight: 800, fontSize: '1rem', color: S.ink, cursor: 'pointer' }}>{n}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '12px' }}>
            {[6, 7, 8, 9, 10].map(n => (
              <button key={n} onClick={() => onSelect(n)} style={{ height: '44px', borderRadius: '10px', border: `2.5px solid ${S.border}`, background: '#fff', fontWeight: 800, fontSize: '1rem', color: S.ink, cursor: 'pointer' }}>{n}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700, color: S.muted, textTransform: 'uppercase' }}>
            <span>Nada probable</span>
            <span>Muy probable</span>
          </div>
        </div>
      )}

      <p className="rf-powered">Powered by retelio.com.mx</p>
    </div>
  );
}

// ─── Step 2: Reason (bad scores only) ─────────────────────────────────────────
function StepReason({ config, onNext, onSkip }) {
  const [selected, setSelected] = useState('');
  const [comment, setComment]   = useState('');

  const type = config?.followup_type || 'multiple_choice';
  const options = config?.followup_options || DEFAULT_OPTIONS;
  const title = config?.followup_question || '¿Qué podríamos mejorar?';

  const handleChip = (opt) => {
    setSelected(opt);
    // Auto-advance after a brief pause so the selection is visible
    if (opt !== 'Otro') {
      setTimeout(() => onNext({ category: opt, comment: comment.trim() || null }), 250);
    }
  };

  const handleNextAction = () => {
    onNext({ category: selected || 'Comentario', comment: comment.trim() || null });
  };

  return (
    <div className="rf-card">
      <Logo />
      <Progress total={3} current={0} />
      <p className="rf-step-label">Paso 1 de 2</p>
      <h2 className="rf-step-title">{title}</h2>

      {type === 'multiple_choice' ? (
        <>
          <div className="rf-chips">
            {options.map(opt => (
              <button key={opt} className={`rf-chip${selected === opt ? ' active' : ''}`} onClick={() => handleChip(opt)}>
                {opt}
              </button>
            ))}
          </div>
          {selected === 'Otro' && (
            <>
              <textarea
                className="rf-textarea"
                rows={3}
                placeholder="Cuéntanos más…"
                value={comment}
                onChange={e => setComment(e.target.value)}
                autoFocus
              />
              <button className="rf-btn rf-btn-primary" onClick={handleNextAction} style={{ marginBottom: 12 }}>
                Continuar
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <textarea
            className="rf-textarea"
            rows={5}
            placeholder="Escribe tu comentario aquí…"
            value={comment}
            onChange={e => setComment(e.target.value)}
            autoFocus
          />
          <button className="rf-btn rf-btn-primary" disabled={!comment.trim()} onClick={handleNextAction} style={{ marginBottom: 12 }}>
            Siguiente
          </button>
        </>
      )}

      <button className="rf-btn rf-btn-ghost" onClick={() => onSkip()}>
        Omitir
      </button>
      <p className="rf-powered">Powered by retelio.com.mx</p>
    </div>
  );
}

// ─── Step 3: Contact (bad scores only) ───────────────────────────────────────
function StepContact({ submitting, onSubmit, onSkip }) {
  const [phone, setPhone] = useState('');

  return (
    <div className="rf-card">
      <Logo />
      <Progress total={3} current={1} />
      <p className="rf-step-label">Paso 2 de 2</p>
      <div style={{ background: '#FFF3F0', border: '1.5px solid #FFCFC4', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>🚨</span>
        <div>
          <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#B91C1C', marginBottom: 2 }}>Ya notificamos al gerente</p>
          <p style={{ fontSize: '0.78rem', color: S.muted, lineHeight: 1.45 }}>Tu caso está en revisión. ¿Quieres que te contacten para resolverlo hoy?</p>
        </div>
      </div>
      <h2 className="rf-step-title">¿Te llamamos para resolverlo?</h2>
      <input
        type="tel"
        className="rf-input"
        placeholder="55 1234 5678"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        autoFocus
      />
      <button
        className="rf-btn rf-btn-primary"
        disabled={!phone.trim() || submitting}
        onClick={() => onSubmit(phone.trim())}
        style={{ marginBottom: 8 }}
      >
        {submitting ? 'Enviando…' : 'Sí, que me llamen'}
      </button>
      <button className="rf-btn rf-btn-ghost" disabled={submitting} onClick={onSkip}>
        No, gracias
      </button>
      <p className="rf-powered">Powered by retelio.com.mx</p>
    </div>
  );
}

// ─── Done: bad score ──────────────────────────────────────────────────────────
function DoneBad({ couponCode, couponConfig, hasPhone }) {
  return (
    <div className="rf-card rf-state">
      <Logo />
      <div className="rf-state-icon">{hasPhone ? '📞' : '⚡'}</div>
      <h2 className="rf-state-title">{hasPhone ? '¡Listo! Te contactamos pronto' : 'Notificamos al equipo'}</h2>
      <p className="rf-state-desc">
        {hasPhone
          ? 'Un manager te contactará en menos de 2 horas para resolver tu caso personalmente.'
          : 'Un manager revisará tu caso hoy y tomará acción para mejorar tu experiencia.'}
      </p>
      {couponCode && couponConfig && (
        <div className="rf-coupon" style={{ textAlign: 'left' }}>
          <p className="rf-coupon-label">Tu cupón de recuperación</p>
          <p className="rf-coupon-code">{couponCode}</p>
          <p className="rf-coupon-desc">{couponConfig.offer_description}</p>
          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,.4)', marginTop: 6 }}>
            Válido {couponConfig.validity_days || 30} días · Presenta al pagar
          </p>
        </div>
      )}
      <p className="rf-powered">Powered by retelio.com.mx</p>
    </div>
  );
}

// ─── Done: neutral ────────────────────────────────────────────────────────────
function DoneNeutral({ onSuggest }) {
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSuggest = () => {
    if (!comment.trim()) return;
    onSuggest(comment.trim());
    setSubmitted(true);
  };

  return (
    <div className="rf-card rf-state">
      <Logo />
      <div className="rf-state-icon">🙏</div>
      <h2 className="rf-state-title">¡Gracias por tu opinión!</h2>
      <p className="rf-state-desc">Tu comentario nos ayuda a mejorar cada día.</p>
      <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 20, textAlign: 'left' }}>
        {!submitted ? (
          <>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: S.ink, marginBottom: 10 }}>
              ¿Qué mejoraría tu experiencia?{' '}
              <span style={{ color: S.muted, fontWeight: 400 }}>(opcional)</span>
            </p>
            <textarea
              className="rf-textarea"
              rows={3}
              placeholder="Tu sugerencia…"
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            {comment.trim() && (
              <button
                className="rf-btn rf-btn-teal"
                onClick={handleSuggest}
                style={{ width: 'auto', padding: '11px 20px', fontSize: '0.9rem' }}
              >
                Compartir sugerencia →
              </button>
            )}
          </>
        ) : (
          <p style={{ fontSize: '0.9rem', color: S.teal, fontWeight: 600, textAlign: 'center' }}>✓ Sugerencia enviada, gracias</p>
        )}
      </div>
      <p className="rf-powered">Powered by retelio.com.mx</p>
    </div>
  );
}

// ─── Done: happy ──────────────────────────────────────────────────────────────
function DoneHappy({ googleUrl, loyaltyCouponCode, loyaltyConfig, onLoyalty }) {
  const [showPhone, setShowPhone] = useState(false);
  const [phone, setPhone]         = useState('');
  const [loyaltyDone, setLoyaltyDone] = useState(false);

  const handleLoyalty = () => {
    if (!phone.trim()) return;
    onLoyalty(phone.trim());
    setLoyaltyDone(true);
  };

  return (
    <div className="rf-card rf-state">
      <Logo />
      <div className="rf-state-icon">🌟</div>
      <h2 className="rf-state-title">¡Nos alegra mucho!</h2>
      <p className="rf-state-desc" style={{ marginBottom: 20 }}>
        Tu visita de hoy nos motiva a seguir dando lo mejor.
      </p>

      {googleUrl && (
        <a href={googleUrl} target="_blank" rel="noreferrer"
          style={{ display: 'block', padding: '16px', background: S.teal, color: '#fff', borderRadius: 14, fontFamily: fontStack, fontWeight: 700, fontSize: '1rem', textDecoration: 'none', textAlign: 'center', marginBottom: 16 }}>
          ⭐ Escribir reseña en Google
        </a>
      )}

      {/* Loyalty coupon — shown automatically if configured */}
      {loyaltyCouponCode && loyaltyConfig && (
        <div className="rf-coupon" style={{ textAlign: 'left', marginBottom: 16 }}>
          <p className="rf-coupon-label">🎁 Tu cupón de cliente frecuente</p>
          <p className="rf-coupon-code">{loyaltyCouponCode}</p>
          <p className="rf-coupon-desc">{loyaltyConfig.loyalty_offer_description}</p>
          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,.4)', marginTop: 6 }}>
            Válido {loyaltyConfig.loyalty_validity_days || 30} días · Presenta al pagar
          </p>
        </div>
      )}

      {/* Loyalty phone capture — only if no coupon configured */}
      {!loyaltyCouponCode && (
        <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 16 }}>
          {loyaltyDone ? (
            <p style={{ fontSize: '0.9rem', color: S.teal, fontWeight: 600, textAlign: 'center' }}>✓ ¡Listo! Te avisaremos de las mejores ofertas</p>
          ) : !showPhone ? (
            <button className="rf-btn rf-btn-ghost" onClick={() => setShowPhone(true)}
              style={{ color: S.ink, fontSize: '0.9rem' }}>
              🎁 Recibir ofertas exclusivas
            </button>
          ) : (
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: S.ink, marginBottom: 10 }}>Tu teléfono para ofertas exclusivas</p>
              <input type="tel" className="rf-input" placeholder="55 1234 5678" value={phone} onChange={e => setPhone(e.target.value)} autoFocus />
              <button className="rf-btn rf-btn-primary" disabled={!phone.trim()} onClick={handleLoyalty}>
                Recibir ofertas →
              </button>
            </div>
          )}
        </div>
      )}

      <p className="rf-powered">Powered by retelio.com.mx</p>
    </div>
  );
}

// ─── Cooldown & Error ─────────────────────────────────────────────────────────
function CooldownScreen({ onSecretTap }) {
  return (
    <div className="rf-card rf-state">
      <Logo onSecretTap={onSecretTap} />
      <div className="rf-state-icon">⏳</div>
      <h2 className="rf-state-title">Ya enviaste tu opinión</h2>
      <p className="rf-state-desc">Solo se permite una respuesta cada 12 horas por dispositivo.</p>
      <p className="rf-powered">Powered by retelio.com.mx</p>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div className="rf-card rf-state">
      <Logo />
      <div className="rf-state-icon">⚠️</div>
      <h2 className="rf-state-title">QR no encontrado</h2>
      <p className="rf-state-desc">{message || 'Este código QR no está activo o no existe.'}</p>
      <p className="rf-powered">Powered by retelio.com.mx</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function FeedbackPublic() {
  const { qrId } = useParams();

  const [qr, setQr]                   = useState(null);
  const [location, setLocation]       = useState(null);
  const [recovery, setRecovery]       = useState(null);
  const [loyalty, setLoyalty]         = useState(null);
  const [questionConfig, setQuestionConfig] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [cooldown, setCooldown]       = useState(false);
  const [error, setError]             = useState(null);
  const [submitting, setSubmitting]   = useState(false);

  // Collected data across steps
  const [score, setScore]           = useState(null);
  const [category, setCategory]     = useState(null);
  const [comment, setComment]       = useState(null);
  const [couponCode, setCouponCode] = useState(null);
  const [loyaltyCouponCode, setLoyaltyCouponCode] = useState(null);
  const [feedbackId, setFeedbackId] = useState(null);
  const [contactPhone, setContactPhone] = useState(null);

  // screen: 'score' | 'reason' | 'contact' | 'done-bad' | 'done-neutral' | 'done-happy'
  const [screen, setScreen] = useState('score');

  const urlParams  = new URLSearchParams(window.location.search);
  const urlTest    = urlParams.get('test') === '1';
  const [testMode, setTestMode] = useState(isTestMode() || urlTest);

  useEffect(() => {
    if (!qrId) { setError('QR ID faltante en la URL.'); setLoading(false); return; }
    loadQR();
  }, [qrId]);

  const loadQR = async () => {
    setLoading(true);
    const { data: qrData, error: qrErr } = await supabase
      .from('qr_codes')
      .select('*, locations(name, google_review_url, whatsapp_number), qr_coupon:coupon_configs(id,name,offer_description,coupon_prefix,validity_days,trigger_type), area:Areas_Catalogo!area_id(id,nombre,coupon_config_id, area_coupon:coupon_configs(id,name,offer_description,coupon_prefix,validity_days,trigger_type))')
      .eq('id', qrId)
      .eq('active', true)
      .single();

    if (qrErr || !qrData) { setError('Este QR no está activo o no existe.'); setLoading(false); return; }

    setQr(qrData);
    setLocation(qrData.locations || null);

    if (qrData.type) {
      const { data: qcData } = await supabase
        .from('qr_type_config')
        .select('*')
        .eq('tenant_id', qrData.tenant_id)
        .eq('qr_type', qrData.type)
        .maybeSingle();
      const baseDefault = { ...DEFAULT_CONFIG, ...(TYPE_DEFAULTS[qrData.type] || {}) };

      if (qcData) {
        // Parse options if stringified
        if (typeof qcData.followup_options === 'string') {
          try { qcData.followup_options = JSON.parse(qcData.followup_options); } catch { qcData.followup_options = baseDefault.followup_options; }
        }
        setQuestionConfig({ ...baseDefault, ...qcData });
      } else {
        setQuestionConfig(baseDefault);
      }
    }

    const { data: rcData } = await supabase
      .from('recovery_config')
      .select('*')
      .eq('tenant_id', qrData.tenant_id)
      .maybeSingle();
    if (rcData) {
      if (rcData.enabled) setRecovery(rcData);
      if (rcData.loyalty_enabled) setLoyalty(rcData);
    }

    const cooldownKey = `rf_sent_${qrId}`;
    const last = localStorage.getItem(cooldownKey);
    if (!testMode && last && Date.now() - parseInt(last) < 12 * 60 * 60 * 1000) setCooldown(true);

    setLoading(false);
  };

  // ── Step handlers ────────────────────────────────────────────────────────────

  const handleScoreSelect = (s) => {
    setScore(s);
    const threshold = questionConfig?.negative_threshold ?? 2;
    const style     = questionConfig?.rating_style || 'emoji';

    if (getIsHappy(s, style)) {
      // Happy: submit immediately, skip reason/contact
      submitFeedback({ score: s, category: null, comment: null, phone: null });
    } else if (getIsUnhappy(s, style, threshold)) {
      // Bad: go to reason step if enabled
      if (questionConfig?.followup_enabled === false) {
        if (questionConfig?.request_contact) setScreen('contact');
        else submitFeedback({ score: s, category: null, comment: null, phone: null });
      } else {
        setScreen('reason');
      }
    } else {
      // Neutral: submit immediately
      submitFeedback({ score: s, category: null, comment: null, phone: null });
    }
  };

  const handleReasonNext = ({ category: cat, comment: cmt }) => {
    setCategory(cat);
    setComment(cmt);
    if (questionConfig?.request_contact === false) {
      submitFeedback({ score, category: cat, comment: cmt, phone: null });
    } else {
      setScreen('contact');
    }
  };

  const handleReasonSkip = () => {
    setCategory(null);
    setComment(null);
    if (questionConfig?.request_contact === false) {
      submitFeedback({ score, category: null, comment: null, phone: null });
    } else {
      setScreen('contact');
    }
  };

  const handleContactSubmit = (phone) => {
    setContactPhone(phone);
    submitFeedback({ score, category, comment, phone });
  };

  const handleContactSkip = () => {
    submitFeedback({ score, category, comment, phone: null });
  };

  const updateFeedback = async (updates) => {
    if (!feedbackId) return;
    await supabase.from('feedbacks').update(updates).eq('id', feedbackId);
  };

  // ── Single INSERT ─────────────────────────────────────────────────────────────
  const submitFeedback = async ({ score: s, category: cat, comment: cmt, phone }) => {
    if (!qr) return;
    setSubmitting(true);

    // Cascade: QR-level → Area-level → Global
    const qrCouponCfg = qr.qr_coupon || qr.area?.area_coupon || null;

    const triggerScore  = recovery?.trigger_score ?? 2;
    const isRecoveryTriggered = questionConfig?.rating_style === 'nps' ? s <= 6 : s <= triggerScore;
    const needsRecovery = (qrCouponCfg?.trigger_type === 'recovery' || recovery?.enabled) && isRecoveryTriggered;
    const recoveryPrefix = qrCouponCfg?.trigger_type === 'recovery'
      ? (qrCouponCfg.coupon_prefix || 'RECOVERY')
      : (recovery?.coupon_prefix || 'RECOVERY');
    const code = needsRecovery ? genCode(recoveryPrefix) : null;
    if (code) setCouponCode(code);

    const loyaltyPrefix = qrCouponCfg?.trigger_type === 'loyalty'
      ? (qrCouponCfg.coupon_prefix || 'LOYAL')
      : (loyalty?.loyalty_coupon_prefix || 'LOYAL');
    const loyaltyCode = getIsHappy(s, questionConfig?.rating_style) && (qrCouponCfg?.trigger_type === 'loyalty' || loyalty?.loyalty_enabled)
      ? genCode(loyaltyPrefix) : null;
    if (loyaltyCode) setLoyaltyCouponCode(loyaltyCode);

    // Use QR coupon config for display if applicable
    if (qrCouponCfg?.trigger_type === 'recovery' && code) {
      setRecovery({ ...recovery, offer_description: qrCouponCfg.offer_description, validity_days: qrCouponCfg.validity_days });
    }
    if (qrCouponCfg?.trigger_type === 'loyalty' && loyaltyCode) {
      setLoyalty({ ...loyalty, loyalty_offer_description: qrCouponCfg.offer_description, loyalty_validity_days: qrCouponCfg.validity_days, loyalty_enabled: true });
    }

    try {
      const { data: inserted, error: insertError } = await supabase.from('feedbacks').insert({
        qr_id:            qrId,
        tenant_id:        qr.tenant_id,
        location_id:      qr.location_id,
        score:            s,
        comment:          cmt || null,
        followup_answer:  cat || null,
        routed_to_google: getIsHappy(s, questionConfig?.rating_style),
        recovery_sent:    needsRecovery || !!loyaltyCode,
        coupon_code:      code || loyaltyCode || null,
        coupon_config_id: qrCouponCfg?.id || null,
        area_id:          qr.area_id || null,
        ip_hash:          getDeviceHash(),
        is_test:          testMode || qr.tenant?.test_mode || false,
        contact_phone:    phone || null,
      }).select('id').single();

      if (insertError) {
        console.error('Insert error:', insertError);
        alert('Error al guardar: ' + insertError.message);
        setSubmitting(false);
        return;
      }
      if (inserted?.id) setFeedbackId(inserted.id);

      if (!testMode) localStorage.setItem(`rf_sent_${qrId}`, Date.now().toString());

      // WhatsApp alert (non-blocking, only if location has a whatsapp_number configured)
      const threshold = questionConfig?.negative_threshold ?? 2;
      if (getIsUnhappy(s, questionConfig?.rating_style, threshold) && qr.tenant_id && location?.whatsapp_number) {
        supabase.functions.invoke('send-whatsapp-alert', {
          body: { tenant_id: qr.tenant_id, location_id: qr.location_id, qr_label: qr.label, score: s, comment: cmt, whatsapp_number: location.whatsapp_number, coupon_code: code },
        }).catch(() => {});
      }

      if (getIsHappy(s, questionConfig?.rating_style))    setScreen('done-happy');
      else if (getIsUnhappy(s, questionConfig?.rating_style, threshold)) setScreen('done-bad');
      else               setScreen('done-neutral');

    } catch (err) {
      console.error('Feedback submit error:', err);
      alert('Error al enviar. Por favor intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  const secretTap = () => {
    const active = toggleTestMode();
    setTestMode(active);
    if (active) setCooldown(false);
  };

  const followupOptions = questionConfig?.followup_options || DEFAULT_OPTIONS;

  const wrap = (content) => (
    <>
      <style>{css}</style>
      <div className="rf">{content}</div>
    </>
  );

  if (loading)  return wrap(<div className="rf-card rf-state" style={{ textAlign: 'center', color: S.muted, fontFamily: fontStack }}>Cargando…</div>);
  if (error)    return wrap(<ErrorScreen message={error} />);
  if (cooldown) return wrap(<CooldownScreen onSecretTap={secretTap} />);

  if (screen === 'score')
    return wrap(<StepScore locationName={location?.name} qrLabel={qr?.label} testMode={testMode} onSecretTap={secretTap} onSelect={handleScoreSelect} config={questionConfig} />);

  if (screen === 'reason')
    return wrap(<StepReason config={questionConfig} onNext={handleReasonNext} onSkip={handleReasonSkip} />);

  if (screen === 'contact')
    return wrap(<StepContact submitting={submitting} onSubmit={handleContactSubmit} onSkip={handleContactSkip} />);

  if (screen === 'done-bad')
    return wrap(<DoneBad couponCode={couponCode} couponConfig={recovery} hasPhone={!!contactPhone} />);

  if (screen === 'done-neutral')
    return wrap(<DoneNeutral onSuggest={(cmt) => updateFeedback({ comment: cmt })} />);

  if (screen === 'done-happy')
    return wrap(<DoneHappy googleUrl={location?.google_review_url} loyaltyCouponCode={loyaltyCouponCode} loyaltyConfig={loyalty} onLoyalty={(ph) => updateFeedback({ contact_phone: ph })} />);

  return null;
}
