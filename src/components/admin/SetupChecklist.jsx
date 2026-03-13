import React from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, Map, QrCode, ChevronRight, CheckCircle2, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SetupChecklist = ({ storesCount = 0, areasCount = 0 }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const steps = [
    {
      id: 'identity',
      emoji: '🎨',
      title: t('onboarding.setup.step1_title', 'Identidad de Marca'),
      desc: t('onboarding.setup.step1_desc', 'Sube tu logo y define el nombre de tu negocio.'),
      cta: t('onboarding.setup.step1_cta', 'Ir a Ajustes'),
      path: '/ajustes',
      completed: false,
      color: '#3b82f6',
      bg: '#eff6ff',
    },
    {
      id: 'structure',
      emoji: '🏢',
      title: t('onboarding.setup.step2_title', 'Mapa de Red'),
      desc: t('onboarding.setup.step2_desc', 'Agrega sucursales y áreas de evaluación.'),
      cta: t('onboarding.setup.step2_cta', 'Ir a Estructura'),
      path: '/estructura',
      completed: storesCount > 0 && areasCount > 0,
      color: '#10b981',
      bg: '#f0fdf4',
    },
    {
      id: 'question',
      emoji: '❓',
      title: t('onboarding.setup.step3_title', 'Primera Pregunta'),
      desc: t('onboarding.setup.step3_desc', 'Define qué le preguntas a tus clientes.'),
      cta: t('onboarding.setup.step3_cta', 'Ir a Preguntas'),
      path: '/preguntas',
      completed: false,
      color: '#8b5cf6',
      bg: '#faf5ff',
    },
    {
      id: 'qr',
      emoji: '📲',
      title: t('onboarding.setup.step4_title', 'Activación QR'),
      desc: t('onboarding.setup.step4_desc', 'Genera e imprime tu primer código QR.'),
      cta: t('onboarding.setup.step4_cta', 'Ir a QR Studio'),
      path: '/qr',
      completed: false,
      color: '#f59e0b',
      bg: '#fffbeb',
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <div style={{
      maxWidth: '600px', margin: '0 auto', padding: '2.5rem 1.5rem',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: '100px', padding: '6px 14px', marginBottom: '1rem',
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('onboarding.setup.badge', 'Configuración inicial')}
          </span>
        </div>
        <h2 style={{
          fontFamily: 'Outfit, sans-serif', fontSize: '2rem', fontWeight: '900',
          color: '#0f172a', margin: '0 0 0.5rem', letterSpacing: '-0.03em',
        }}>
          {t('onboarding.setup.title', 'Lista de Despegue')}
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
          {t('onboarding.setup.subtitle', '4 pasos para iniciar tu era de datos.')}
        </p>

        {/* Progress bar */}
        <div style={{ background: '#f1f5f9', borderRadius: '100px', height: '8px', maxWidth: '300px', margin: '0 auto' }}>
          <div style={{
            height: '8px', borderRadius: '100px',
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
            width: `${Math.max(progressPct, 4)}%`,
            transition: 'width 0.6s ease',
          }} />
        </div>
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.5rem', fontWeight: '600' }}>
          {completedCount}/{steps.length} {t('onboarding.setup.complete', 'completados')}
        </p>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {steps.map((step, index) => (
          <div
            key={step.id}
            onClick={() => navigate(step.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1.1rem 1.25rem',
              background: step.completed ? '#f0fdf4' : 'white',
              border: `1.5px solid ${step.completed ? '#bbf7d0' : '#f1f5f9'}`,
              borderRadius: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'}
          >
            {/* Step number / completion */}
            <div style={{
              width: '44px', height: '44px', borderRadius: '14px',
              background: step.completed ? '#dcfce7' : step.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: '1.3rem',
              border: `1.5px solid ${step.completed ? '#86efac' : 'transparent'}`,
            }}>
              {step.completed ? '✅' : step.emoji}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{
                  fontSize: '0.68rem', fontWeight: '800', color: '#94a3b8',
                  textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                  {t('onboarding.setup.step', 'Paso')} {index + 1}
                </span>
                {step.completed && (
                  <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#10b981', background: '#dcfce7', padding: '1px 8px', borderRadius: '20px' }}>
                    ✓ {t('onboarding.setup.done', 'Listo')}
                  </span>
                )}
              </div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>
                {step.title}
              </h4>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0, marginTop: '2px' }}>
                {step.desc}
              </p>
            </div>

            {/* Arrow */}
            <div style={{ color: '#cbd5e1', flexShrink: 0 }}>
              <ChevronRight size={18} />
            </div>
          </div>
        ))}
      </div>

      {/* Help section */}
      <div style={{
        marginTop: '1.75rem', padding: '1.25rem',
        background: 'linear-gradient(135deg, #eff6ff, #faf5ff)',
        borderRadius: '16px', border: '1px solid #dbeafe', textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
          {t('onboarding.setup.help_title', '¿Necesitas orientación?')}
        </p>
        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
          {t('onboarding.setup.help_desc', 'Explora con datos demo para entender la plataforma antes de configurarla.')}
        </p>
      </div>
    </div>
  );
};

export default SetupChecklist;
