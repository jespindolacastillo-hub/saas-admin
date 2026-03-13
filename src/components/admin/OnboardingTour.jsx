import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, QrCode, TrendingUp, X, ChevronRight, Check } from 'lucide-react';

const OnboardingTour = ({ onFinish }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const hasSeenTour = localStorage.getItem('ps_onboarding_seen');
        if (!hasSeenTour) {
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const steps = [
        {
            title: t('onboarding.welcome'),
            desc: t('settings.subtitle'),
            icon: <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl"><TrendingUp size={32} /></div>,
        },
        {
            title: t('onboarding.step1_title'),
            desc: t('onboarding.step1_desc'),
            icon: <div className="p-4 bg-purple-100 text-purple-600 rounded-2xl"><Palette size={32} /></div>,
        },
        {
            title: t('onboarding.step2_title'),
            desc: t('onboarding.step2_desc'),
            icon: <div className="p-4 bg-emerald-100 text-emerald-600 rounded-2xl"><QrCode size={32} /></div>,
        },
        {
            title: t('onboarding.step3_title'),
            desc: t('onboarding.step3_desc'),
            icon: <div className="p-4 bg-amber-100 text-amber-600 rounded-2xl"><TrendingUp size={32} /></div>,
        }
    ];

    const handleFinish = () => {
        setIsVisible(false);
        localStorage.setItem('ps_onboarding_seen', 'true');
        if (onFinish) onFinish();
    };

    if (!isVisible) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="relative p-8">
                    <button 
                        onClick={handleFinish}
                        className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                        <X size={20} />
                    </button>

                    <div className="flex flex-col items-center text-center mt-4">
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                            <div className={`tour-icon-box ${step === 0 ? 'tour-bg-blue' : step === 1 ? 'tour-bg-purple' : step === 2 ? 'tour-bg-emerald' : 'tour-bg-amber'}`}>
                                {steps[step].icon}
                            </div>
                        </div>
                        
                        <h2 className="text-2xl font-extrabold text-slate-800 mb-3 tracking-tight font-outfit">
                            {steps[step].title}
                        </h2>
                        <p className="text-slate-500 leading-relaxed" style={{ maxWidth: '280px', margin: '0 auto' }}>
                            {steps[step].desc}
                        </p>
                    </div>

                    <div className="mt-10 flex flex-col gap-4">
                        <div className="tour-step-pills">
                            {steps.map((_, i) => (
                                <div 
                                    key={i} 
                                    className={`tour-step-pill ${step === i ? 'active' : 'inactive'}`}
                                />
                            ))}
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            {step < steps.length - 1 ? (
                                <button 
                                    onClick={() => setStep(step + 1)}
                                    className="btn btn-primary"
                                    style={{ width: '100%', height: '54px', borderRadius: '16px', fontSize: '1rem' }}
                                >
                                    {t('onboarding.next')} <ChevronRight size={20} />
                                </button>
                            ) : (
                                <button 
                                    onClick={handleFinish}
                                    className="btn btn-dark"
                                    style={{ width: '100%', height: '54px', borderRadius: '16px', fontSize: '1rem', background: '#0f172a', color: 'white' }}
                                >
                                    {t('onboarding.finish')} <Check size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                
                <div style={{ background: '#f8fafc', padding: '1rem', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.1em', color: '#94a3b8' }}>
                        Powered by Antigravity AI
                    </span>
                </div>
            </div>
        </div>
    );
};

export default OnboardingTour;
