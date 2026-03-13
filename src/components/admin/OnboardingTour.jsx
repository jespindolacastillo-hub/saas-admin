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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-500">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-500 border border-slate-100">
                <div className="relative p-8">
                    <button 
                        onClick={handleFinish}
                        className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex flex-col items-center text-center mt-4">
                        <div className="mb-6 transform transition-all duration-700 scale-110">
                            {steps[step].icon}
                        </div>
                        
                        <h2 className="text-2xl font-extrabold text-slate-800 mb-3 tracking-tight font-outfit">
                            {steps[step].title}
                        </h2>
                        <p className="text-slate-500 leading-relaxed max-w-[280px]">
                            {steps[step].desc}
                        </p>
                    </div>

                    <div className="mt-10 flex flex-col gap-4">
                        <div className="flex justify-center gap-2 mb-2">
                            {steps.map((_, i) => (
                                <div 
                                    key={i} 
                                    className={`h-1.5 rounded-full transition-all duration-500 ${step === i ? 'w-8 bg-blue-600' : 'w-2 bg-slate-200'}`}
                                />
                            ))}
                        </div>

                        {step < steps.length - 1 ? (
                            <button 
                                onClick={() => setStep(step + 1)}
                                className="w-full h-14 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 transition-all"
                            >
                                {t('onboarding.next')} <ChevronRight size={20} />
                            </button>
                        ) : (
                            <button 
                                onClick={handleFinish}
                                className="w-full h-14 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black hover:shadow-lg hover:shadow-slate-500/25 active:scale-95 transition-all"
                            >
                                {t('onboarding.finish')} <Check size={20} />
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 text-center">
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                        Powered by Antigravity AI
                    </span>
                </div>
            </div>
        </div>
    );
};

export default OnboardingTour;
