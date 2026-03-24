import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ─── Sentiment thresholds ────────────────────────────────────────────────────
const isHappy    = (s) => s >= 4;
const isUnhappy  = (s) => s <= 2;
const isNeutral  = (s) => s === 3;

// ─── Simple IP hash for dedup (client-side only) ─────────────────────────────
const getDeviceHash = () => {
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
  ].join('|');
  let h = 0;
  for (let i = 0; i < parts.length; i++) {
    h = Math.imul(31, h) + parts.charCodeAt(i) | 0;
  }
  return 'dv_' + Math.abs(h).toString(16);
};

// ─── Styles (Retelio design tokens) ──────────────────────────────────────────
const S = {
  coral:  '#FF5C3A',
  teal:   '#00C9A7',
  purple: '#7C3AED',
  ink:    '#0D0D12',
  bg:     '#F7F8FC',
  card:   '#FFFFFF',
  muted:  '#6B7280',
  border: '#E5E7EB',
};

const fontStack = "'Plus Jakarta Sans', system-ui, sans-serif";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  .retelio-feedback * { box-sizing: border-box; margin: 0; padding: 0; }
  .retelio-feedback { font-family: ${fontStack}; background: ${S.bg}; min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 24px; }

  .rf-card { background: ${S.card}; border-radius: 24px; padding: 40px 32px;
    width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(13,13,18,.08); }

  .rf-logo { display: flex; align-items: center; gap: 8px; margin-bottom: 32px; }
  .rf-logo-dots { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; width: 20px; height: 20px; }
  .rf-logo-dot { border-radius: 2px; }
  .rf-logo-word { font-size: 1.1rem; font-weight: 800; color: ${S.ink}; letter-spacing: -0.02em; }

  .rf-location { font-size: 0.75rem; font-weight: 600; color: ${S.muted};
    text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .rf-question { font-size: 1.5rem; font-weight: 800; color: ${S.ink};
    line-height: 1.25; margin-bottom: 32px; }

  .rf-stars { display: flex; gap: 10px; justify-content: center; margin-bottom: 12px; }
  .rf-star { font-size: 2.8rem; cursor: pointer; transition: transform .15s ease;
    user-select: none; filter: grayscale(1) opacity(.35); }
  .rf-star.active { filter: none; transform: scale(1.1); }
  .rf-star:hover { transform: scale(1.15); filter: none; }

  .rf-label { text-align: center; font-size: 0.85rem; font-weight: 600;
    color: ${S.muted}; height: 20px; margin-bottom: 28px; transition: color .2s; }

  .rf-textarea { width: 100%; border: 1.5px solid ${S.border}; border-radius: 12px;
    padding: 12px 14px; font-family: ${fontStack}; font-size: 0.95rem; resize: none;
    outline: none; transition: border-color .2s; margin-bottom: 20px; }
  .rf-textarea:focus { border-color: ${S.coral}; }

  .rf-btn { width: 100%; padding: 14px; border: none; border-radius: 12px;
    font-family: ${fontStack}; font-size: 1rem; font-weight: 700; cursor: pointer;
    transition: opacity .15s, transform .1s; }
  .rf-btn:disabled { opacity: .5; cursor: not-allowed; }
  .rf-btn:not(:disabled):active { transform: scale(.98); }
  .rf-btn-primary { background: ${S.coral}; color: #fff; }
  .rf-btn-teal    { background: ${S.teal};  color: #fff; }
  .rf-btn-ghost   { background: transparent; color: ${S.muted};
    border: 1.5px solid ${S.border}; margin-top: 10px; }

  .rf-state { text-align: center; }
  .rf-state-icon { font-size: 3.5rem; margin-bottom: 16px; }
  .rf-state-title { font-size: 1.4rem; font-weight: 800; color: ${S.ink}; margin-bottom: 8px; }
  .rf-state-desc  { font-size: 0.95rem; color: ${S.muted}; line-height: 1.55; margin-bottom: 28px; }

  .rf-divider { border: none; border-top: 1px solid ${S.border}; margin: 24px 0; }
  .rf-powered { text-align: center; font-size: 0.7rem; color: #CBD5E1; margin-top: 28px; }
`;

// ─── Star labels ──────────────────────────────────────────────────────────────
const STAR_LABELS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', '¡Excelente!'];
const STAR_EMOJIS = ['', '😤', '😕', '😐', '😊', '🤩'];

// ─── Coupon code generator ────────────────────────────────────────────────────
const genCode = (prefix = 'RECOVERY') => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${code}`;
};

// ─── Replace template vars ────────────────────────────────────────────────────
const renderTemplate = (tpl, vars) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || `{{${k}}}`);

// ─── Test mode helpers ────────────────────────────────────────────────────────
const TEST_MODE_KEY = 'rf_test_mode';
const isTestMode = () => localStorage.getItem(TEST_MODE_KEY) === 'on';
const toggleTestMode = () => {
  const next = isTestMode() ? null : 'on';
  next ? localStorage.setItem(TEST_MODE_KEY, 'on') : localStorage.removeItem(TEST_MODE_KEY);
  return !!next;
};

// ─── Screens ──────────────────────────────────────────────────────────────────

function Logo({ onSecretTap }) {
  const [taps, setTaps] = useState(0);

  const handleTap = () => {
    if (!onSecretTap) return;
    const next = taps + 1;
    setTaps(next);
    if (next >= 5) { setTaps(0); onSecretTap(); }
  };

  return (
    <div className="rf-logo" onClick={handleTap} style={{ cursor: onSecretTap ? 'default' : undefined }}>
      <div className="rf-logo-dots">
        {[S.coral, S.teal, S.teal, S.coral].map((c, i) => (
          <div key={i} className="rf-logo-dot" style={{ background: c }} />
        ))}
      </div>
      <span className="rf-logo-word">retelio</span>
    </div>
  );
}

const DEFAULT_Q_CONFIG = {
  main_question: '¿Cómo fue tu experiencia hoy?',
  rating_style: 'emoji',
  negative_threshold: 2,
  followup_enabled: true,
  followup_type: 'multiple_choice',
  followup_question: '¿Qué podríamos mejorar?',
  followup_options: ['Tiempo de espera', 'Trato del personal', 'Calidad', 'Limpieza', 'Precio', 'Otro'],
  request_contact: true,
};
const EMOJIS = ['', '😤', '😕', '😐', '😊', '🤩'];

function RatingScreen({ locationName, qrLabel, questionConfig, onSubmit, submitting, testMode, onSecretTap }) {
  const cfg = { ...DEFAULT_Q_CONFIG, ...(questionConfig || {}) };
  const [score, setScore]             = useState(0);
  const [comment, setComment]         = useState('');
  const [followupAnswer, setFollowup] = useState('');

  const showFollowup = cfg.followup_enabled && score > 0 && score <= cfg.negative_threshold;
  const requireComment = score > 0 && score <= 2 && !cfg.followup_enabled;
  const canSubmit = score > 0 && !submitting && (!requireComment || comment.trim());

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ score, comment, followup_answer: followupAnswer || null });
  };

  // Replace {{nombre}} placeholder with qrLabel
  const mainQuestion = cfg.main_question.replace(/\{\{nombre\}\}/g, qrLabel || '');

  return (
    <div className="rf-card">
      <Logo onSecretTap={onSecretTap} />
      {testMode && (
        <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8,
          padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700, color: '#92400e',
          marginBottom: 12, textAlign: 'center' }}>
          🧪 MODO PRUEBA — cooldown desactivado (toca el logo 5× para apagar)
        </div>
      )}
      {locationName && <div className="rf-location">{locationName}{qrLabel ? ` · ${qrLabel}` : ''}</div>}
      <h1 className="rf-question">{mainQuestion}</h1>

      {/* Emoji rating */}
      {cfg.rating_style === 'emoji' && (
        <>
          <div className="rf-stars">
            {[1,2,3,4,5].map(n => (
              <span key={n} className={`rf-star${score === n ? ' active' : ''}`}
                onClick={() => setScore(n)} role="button" aria-label={`${n}`}>
                {EMOJIS[n]}
              </span>
            ))}
          </div>
          <div className="rf-label" style={{ color: score > 0 ? S.ink : S.muted }}>
            {score > 0 ? STAR_LABELS[score] : 'Toca para calificar'}
          </div>
        </>
      )}

      {/* Stars rating */}
      {cfg.rating_style === 'stars' && (
        <>
          <div className="rf-stars">
            {[1,2,3,4,5].map(n => (
              <span key={n} className={`rf-star${score >= n ? ' active' : ''}`}
                onClick={() => setScore(n)} role="button">⭐</span>
            ))}
          </div>
          <div className="rf-label" style={{ color: score > 0 ? S.ink : S.muted }}>
            {score > 0 ? `${score} estrella${score > 1 ? 's' : ''}` : 'Toca para calificar'}
          </div>
        </>
      )}

      {/* NPS rating */}
      {cfg.rating_style === 'nps' && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
            {[...Array(11)].map((_, i) => (
              <button key={i} onClick={() => setScore(i === 0 ? 0.1 : i)}
                style={{ width: 40, height: 40, borderRadius: 10, border: `2px solid ${score === (i === 0 ? 0.1 : i) ? S.coral : S.border}`, background: score === (i === 0 ? 0.1 : i) ? S.coral : '#fff', color: score === (i === 0 ? 0.1 : i) ? '#fff' : S.muted, fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer' }}>
                {i}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: S.muted }}>
            <span>Nada probable</span><span>Muy probable</span>
          </div>
        </div>
      )}

      {/* Follow-up question */}
      {showFollowup && (
        <div style={{ marginBottom: 20, padding: '16px', background: '#FFF1EE', borderRadius: 14, border: `1.5px solid ${S.coral}22` }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 700, color: S.ink, marginBottom: 12 }}>{cfg.followup_question}</p>
          {cfg.followup_type === 'multiple_choice' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(cfg.followup_options || []).map((opt, i) => (
                <button key={i} onClick={() => setFollowup(opt)}
                  style={{ padding: '10px 14px', borderRadius: 10, border: `2px solid ${followupAnswer === opt ? S.coral : S.border}`, background: followupAnswer === opt ? S.coral + '12' : '#fff', color: followupAnswer === opt ? S.coral : S.ink, fontWeight: followupAnswer === opt ? 700 : 500, fontSize: '0.88rem', cursor: 'pointer', textAlign: 'left' }}>
                  {opt}
                </button>
              ))}
              <textarea className="rf-textarea" rows={3}
                placeholder="Cuéntanos más (opcional)…"
                value={comment} onChange={e => setComment(e.target.value)}
                style={{ marginTop: 8, marginBottom: 0 }} />
            </div>
          ) : (
            <textarea className="rf-textarea" rows={3}
              placeholder="Cuéntanos qué pasó…"
              value={followupAnswer} onChange={e => setFollowup(e.target.value)}
              style={{ marginBottom: 0 }} />
          )}
        </div>
      )}

      {/* Optional open comment for non-followup negative */}
      {!showFollowup && score > 0 && score <= 2 && (
        <textarea className="rf-textarea" rows={3}
          placeholder="¿Qué podemos mejorar? (opcional)"
          value={comment} onChange={e => setComment(e.target.value)} />
      )}

      <button className="rf-btn rf-btn-primary"
        disabled={!canSubmit}
        onClick={handleSubmit}>
        {submitting ? 'Enviando…' : 'Enviar'}
      </button>

      <p className="rf-powered">Powered by retelio.com.mx</p>
    </div>
  );
}

function HappyScreen({ googleUrl }) {
  return (
    <div className="rf-card rf-state">
      <Logo />
      <div className="rf-state-icon">🌟</div>
      <h2 className="rf-state-title">¡Gracias por tu comentario!</h2>
      <p className="rf-state-desc">
        Tu opinión nos ayuda a mejorar. ¿Te gustaría compartirla en Google para que otros también puedan conocernos?
      </p>
      {googleUrl ? (
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <button className="rf-btn rf-btn-teal">
            ⭐ Dejar reseña en Google
          </button>
        </a>
      ) : (
        <p style={{ color: S.muted, fontSize: '0.85rem' }}>
          (Google Reviews no configurado aún)
        </p>
      )}
      <p className="rf-powered">Powered by retelio.com.mx</p>
    </div>
  );
}

function UnhappyScreen({ onClose, onContactSubmit }) {
  const [step, setStep]       = useState('ask');   // ask | form | done
  const [phone, setPhone]     = useState('');
  const [email, setEmail]     = useState('');
  const [sending, setSending] = useState(false);

  const canSubmit = phone.trim() || email.trim();

  const handleSend = async () => {
    if (!canSubmit) return;
    setSending(true);
    await onContactSubmit?.({ phone: phone.trim(), email: email.trim() });
    setSending(false);
    setStep('done');
  };

  if (step === 'done') {
    return (
      <div className="rf-card rf-state">
        <Logo />
        <div className="rf-state-icon">✅</div>
        <h2 className="rf-state-title">¡Listo!</h2>
        <p className="rf-state-desc">
          Nos comunicaremos contigo pronto para resolver tu experiencia.
        </p>
        <p className="rf-powered">Powered by retelio.com.mx</p>
      </div>
    );
  }

  if (step === 'form') {
    return (
      <div className="rf-card">
        <Logo />
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📲</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: S.ink, marginBottom: 8 }}>
            ¿Cómo te contactamos?
          </h2>
          <p style={{ fontSize: '0.9rem', color: S.muted }}>
            Deja tu teléfono o email para darte seguimiento.
          </p>
        </div>
        <input
          type="tel"
          placeholder="Teléfono: 55 1234 5678"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          style={{
            width: '100%', border: `1.5px solid ${S.border}`, borderRadius: 12,
            padding: '12px 14px', fontFamily: fontStack, fontSize: '1rem',
            outline: 'none', marginBottom: 10, boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = S.teal}
          onBlur={e => e.target.style.borderColor = S.border}
        />
        <input
          type="email"
          placeholder="Email (opcional)"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{
            width: '100%', border: `1.5px solid ${S.border}`, borderRadius: 12,
            padding: '12px 14px', fontFamily: fontStack, fontSize: '1rem',
            outline: 'none', marginBottom: 16, boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = S.teal}
          onBlur={e => e.target.style.borderColor = S.border}
        />
        <button
          className="rf-btn rf-btn-teal"
          onClick={handleSend}
          disabled={!canSubmit || sending}
        >
          {sending ? 'Enviando…' : 'Confirmar'}
        </button>
        <button className="rf-btn rf-btn-ghost" onClick={onClose}>
          No es necesario
        </button>
        <p className="rf-powered">Powered by retelio.com.mx</p>
      </div>
    );
  }

  // step === 'ask'
  return (
    <div className="rf-card rf-state">
      <Logo />

      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px', fontSize: '2rem',
      }}>
        😔
      </div>

      <h2 className="rf-state-title">Lo sentimos mucho</h2>
      <p className="rf-state-desc">
        Tu experiencia no fue la que merecías.<br />
        Ya notificamos al equipo.
      </p>

      <div style={{
        background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12,
        padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: '1.1rem' }}>⚡</span>
        <p style={{ fontSize: '0.82rem', color: '#166534', fontWeight: 500, lineHeight: 1.5 }}>
          Un manager ya recibió una alerta y atenderá tu caso en los próximos minutos.
        </p>
      </div>

      <p style={{ fontSize: '0.9rem', color: S.muted, marginBottom: 16, fontWeight: 500 }}>
        ¿Quieres que te contactemos directamente?
      </p>

      <button
        className="rf-btn rf-btn-teal"
        onClick={() => setStep('form')}
        style={{ marginBottom: 10 }}
      >
        Sí, contáctenme
      </button>
      <button className="rf-btn rf-btn-ghost" onClick={onClose}>
        No es necesario, gracias
      </button>

      <p className="rf-powered">Powered by retelio.com.mx</p>
    </div>
  );
}

function NeutralScreen() {
  return (
    <div className="rf-card rf-state">
      <Logo />
      <div className="rf-state-icon">🙏</div>
      <h2 className="rf-state-title">¡Gracias por tu tiempo!</h2>
      <p className="rf-state-desc">
        Tu opinión nos ayuda a mejorar cada día.
      </p>
      <p className="rf-powered">Powered by retelio.com.mx</p>
    </div>
  );
}

function RecoveryScreen({ config, couponCode, tenantName, onContactSubmit }) {
  const [step, setStep]   = useState('offer'); // offer | form | done
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const canSubmit = phone.trim() || email.trim();

  const message = renderTemplate(config.message_template || '', {
    oferta:  config.offer_description || '',
    codigo:  couponCode,
    dias:    config.validity_days || '30',
    negocio: tenantName || 'nosotros',
  });

  const handleSend = async () => {
    if (!canSubmit) return;
    setSending(true);
    await onContactSubmit?.({ phone: phone.trim(), email: email.trim() });
    setSending(false);
    setStep('done');
  };

  if (step === 'done') {
    return (
      <div className="rf-card rf-state">
        <Logo />
        <div className="rf-state-icon">✅</div>
        <h2 className="rf-state-title">¡Listo!</h2>
        <p className="rf-state-desc">Nos comunicaremos contigo pronto.</p>
        <p className="rf-powered">Powered by retelio.com.mx</p>
      </div>
    );
  }

  if (step === 'form') {
    return (
      <div className="rf-card">
        <Logo />
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📲</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: S.ink, marginBottom: 8 }}>¿Cómo te contactamos?</h2>
          <p style={{ fontSize: '0.9rem', color: S.muted }}>Teléfono o email para enviarte tu cupón.</p>
        </div>
        <input
          type="tel" placeholder="Teléfono: 55 1234 5678" value={phone}
          onChange={e => setPhone(e.target.value)}
          style={{ width: '100%', border: `1.5px solid ${S.border}`, borderRadius: 12, padding: '12px 14px', fontFamily: fontStack, fontSize: '1rem', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = S.teal}
          onBlur={e => e.target.style.borderColor = S.border}
        />
        <input
          type="email" placeholder="Email (opcional)" value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', border: `1.5px solid ${S.border}`, borderRadius: 12, padding: '12px 14px', fontFamily: fontStack, fontSize: '1rem', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = S.teal}
          onBlur={e => e.target.style.borderColor = S.border}
        />
        <button className="rf-btn rf-btn-teal" onClick={handleSend} disabled={!canSubmit || sending}>{sending ? 'Enviando…' : 'Confirmar'}</button>
        <button className="rf-btn rf-btn-ghost" onClick={() => setStep('offer')}>Volver</button>
        <p className="rf-powered">Powered by retelio.com.mx</p>
      </div>
    );
  }

  // step === 'offer'
  return (
    <div className="rf-card">
      <Logo />

      {/* Apology */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #fee2e2, #fecaca)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '1.8rem' }}>😔</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: S.ink, marginBottom: 6 }}>Lo sentimos mucho</h2>
        <p style={{ fontSize: '0.9rem', color: S.muted, lineHeight: 1.5 }}>
          {message.split(couponCode)[0]}
        </p>
      </div>

      {/* Coupon card */}
      <div style={{
        background: `linear-gradient(135deg, ${S.ink} 0%, #1a0f0a 100%)`,
        borderRadius: 18, padding: '22px 20px', marginBottom: 20, textAlign: 'center',
        boxShadow: `0 8px 32px ${S.coral}30`,
      }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: S.teal, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>
          Tu cupón de recuperación
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', letterSpacing: '0.08em', marginBottom: 8, fontFamily: 'monospace' }}>
          {couponCode}
        </div>
        <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>
          {config.offer_description}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
          Válido {config.validity_days || 30} días · Presenta este código al pagar
        </div>
      </div>

      {config.terms ? (
        <p style={{ fontSize: '0.7rem', color: S.muted, textAlign: 'center', marginBottom: 16 }}>{config.terms}</p>
      ) : null}

      <button className="rf-btn rf-btn-teal" onClick={() => setStep('form')} style={{ marginBottom: 8 }}>
        Quiero que me contacten también
      </button>
      <button className="rf-btn rf-btn-ghost" onClick={() => setStep('done')}>
        Solo el cupón, gracias
      </button>

      <p className="rf-powered">Powered by retelio.com.mx</p>
    </div>
  );
}

function CooldownScreen({ onSecretTap }) {
  return (
    <div className="rf-card rf-state">
      <Logo onSecretTap={onSecretTap} />
      <div className="rf-state-icon">⏳</div>
      <h2 className="rf-state-title">Ya enviaste tu opinión</h2>
      <p className="rf-state-desc">
        Gracias. Solo se permite una respuesta cada 12 horas por dispositivo.
      </p>
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

  const [qr, setQr]             = useState(null);
  const [location, setLocation] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [questionConfig, setQuestionConfig] = useState(null);
  const [couponCode, setCouponCode] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [cooldown, setCooldown] = useState(false);
  const [screen, setScreen]     = useState('rating'); // rating | happy | unhappy | recovery | neutral
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState(null);
  const urlParams = new URLSearchParams(window.location.search);
  const urlTestMode = urlParams.get('test') === '1';
  const [testMode, setTestMode] = useState(isTestMode() || urlTestMode);
  const [submittedFeedbackId, setSubmittedFeedbackId] = useState(null);

  useEffect(() => {
    if (!qrId) { setError('QR ID faltante en la URL.'); setLoading(false); return; }
    loadQR();
  }, [qrId]);

  const loadQR = async () => {
    setLoading(true);

    // 1. Load QR record
    const { data: qrData, error: qrErr } = await supabase
      .from('qr_codes')
      .select('*, locations(name, google_review_url, whatsapp_number)')
      .eq('id', qrId)
      .eq('active', true)
      .single();

    if (qrErr || !qrData) {
      setError('Este QR no está activo o no existe.');
      setLoading(false);
      return;
    }

    setQr(qrData);
    setLocation(qrData.locations || null);

    // Load question config for this QR type
    if (qrData.type) {
      const { data: qcData } = await supabase
        .from('qr_type_config')
        .select('*')
        .eq('tenant_id', qrData.tenant_id)
        .eq('qr_type', qrData.type)
        .maybeSingle();
      if (qcData) setQuestionConfig(qcData);
    }

    // Load recovery config for this tenant
    const { data: rcData } = await supabase
      .from('recovery_config')
      .select('*')
      .eq('tenant_id', qrData.tenant_id)
      .eq('enabled', true)
      .maybeSingle();
    if (rcData) setRecovery(rcData);

    // 2. Cooldown check (localStorage) — skipped in test mode
    const cooldownKey = `rf_sent_${qrId}`;
    const last = localStorage.getItem(cooldownKey);
    if (!testMode && last && Date.now() - parseInt(last) < 12 * 60 * 60 * 1000) {
      setCooldown(true);
    }

    setLoading(false);
  };

  const handleSubmit = async ({ score, comment, followup_answer }) => {
    if (!qr) return;
    setSubmitting(true);

    const deviceHash = getDeviceHash();
    const cooldownKey = `rf_sent_${qrId}`;

    try {
      // Determine recovery eligibility
      const triggerScore = recovery?.trigger_score ?? 2;
      const needsRecovery = recovery?.enabled && score <= triggerScore;
      const code = needsRecovery ? genCode(recovery.coupon_prefix || 'RECOVERY') : null;

      // Insert feedback
      const { data: insData, error: insErr } = await supabase.from('feedbacks').insert({
        qr_id:            qrId,
        tenant_id:        qr.tenant_id,
        location_id:      qr.location_id,
        score,
        comment:          comment || null,
        followup_answer:  followup_answer || null,
        routed_to_google: isHappy(score),
        recovery_sent:    needsRecovery,
        coupon_code:      code,
        ip_hash:          deviceHash,
        is_test:          testMode || false,
      }).select('id').single();

      if (insErr) throw insErr;
      if (insData?.id) setSubmittedFeedbackId(insData.id);

      // Mark cooldown (skip in test mode so device can submit multiple times)
      if (!testMode) localStorage.setItem(cooldownKey, Date.now().toString());

      // WhatsApp alert for unhappy (non-blocking)
      if (isUnhappy(score) && qr.tenant_id) {
        supabase.functions.invoke('send-whatsapp-alert', {
          body: {
            tenant_id:   qr.tenant_id,
            location_id: qr.location_id,
            qr_label:    qr.label,
            score,
            comment,
            whatsapp_number: location?.whatsapp_number,
            coupon_code: code,
          },
        }).catch(() => {});
      }

      // Route by sentiment
      if (isHappy(score)) {
        setScreen('happy');
      } else if (needsRecovery) {
        setCouponCode(code);
        setScreen('recovery');
      } else if (isUnhappy(score)) {
        setScreen('unhappy');
      } else {
        setScreen('neutral');
      }

    } catch (err) {
      console.error('Feedback submit error:', err);
      alert('Error al enviar. Por favor intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <style>{css}</style>
        <div className="retelio-feedback">
          <div className="rf-card rf-state">
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
            <p style={{ color: S.muted, fontFamily: fontStack }}>Cargando…</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <style>{css}</style>
        <div className="retelio-feedback">
          <ErrorScreen message={error} />
        </div>
      </>
    );
  }

  const secretTapHandler = () => {
    const active = toggleTestMode();
    setTestMode(active);
    if (active) setCooldown(false);
  };

  if (cooldown) {
    return (
      <>
        <style>{css}</style>
        <div className="retelio-feedback">
          <CooldownScreen onSecretTap={secretTapHandler} />
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="retelio-feedback">
        {screen === 'rating' && (
          <RatingScreen
            locationName={location?.name}
            qrLabel={qr?.label}
            questionConfig={questionConfig}
            onSubmit={handleSubmit}
            submitting={submitting}
            testMode={testMode}
            onSecretTap={secretTapHandler}
          />
        )}
        {screen === 'happy' && (
          <HappyScreen googleUrl={location?.google_review_url} />
        )}
        {screen === 'recovery' && recovery && (
          <RecoveryScreen
            config={recovery}
            couponCode={couponCode}
            tenantName={qr?.tenant_name || location?.name}
            onContactSubmit={async ({ phone, email }) => {
              const update = {};
              if (phone) update.contact_phone = phone;
              if (email) update.contact_email = email;
              if (Object.keys(update).length && submittedFeedbackId) {
                const { error: upErr } = await supabase.from('feedbacks').update(update).eq('id', submittedFeedbackId);
                if (upErr) console.error('Contact update error:', upErr.message);
              } else {
                console.warn('Contact not saved — feedbackId:', submittedFeedbackId, 'update:', update);
              }
            }}
          />
        )}
        {screen === 'unhappy' && (
          <UnhappyScreen
            onClose={() => setScreen('done')}
            onContactSubmit={async ({ phone, email }) => {
              const update = {};
              if (phone) update.contact_phone = phone;
              if (email) update.contact_email = email;
              if (Object.keys(update).length && submittedFeedbackId) {
                const { error: upErr } = await supabase.from('feedbacks').update(update).eq('id', submittedFeedbackId);
                if (upErr) console.error('Contact update error:', upErr.message);
              } else {
                console.warn('Contact not saved — feedbackId:', submittedFeedbackId, 'update:', update);
              }
            }}
          />
        )}
        {screen === 'neutral' && <NeutralScreen />}
        {screen === 'done'   && <NeutralScreen />}
      </div>
    </>
  );
}
