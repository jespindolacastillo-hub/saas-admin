import React from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, Map, QrCode, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SetupChecklist = ({ storesCount = 0, areasCount = 0 }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const steps = [
        {
            id: 'identity',
            title: t('onboarding.setup.step1_title'),
            desc: t('onboarding.setup.step1_desc'),
            icon: <Palette size={24} />,
            path: '/ajustes',
            completed: false // Logic can be added later to check if logo exists
        },
        {
            id: 'structure',
            title: t('onboarding.setup.step2_title'),
            desc: t('onboarding.setup.step2_desc'),
            icon: <Map size={24} />,
            path: '/estructura',
            completed: storesCount > 0 && areasCount > 0
        },
        {
            id: 'qr',
            title: t('onboarding.setup.step3_title'),
            desc: t('onboarding.setup.step3_desc'),
            icon: <QrCode size={24} />,
            path: '/qr',
            completed: false
        }
    ];

    return (
        <div className="setup-checklist-container animate-fade-in">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-slate-800 mb-2 font-outfit uppercase tracking-tight">
                    {t('onboarding.setup.title')}
                </h2>
                <p className="text-slate-500 max-w-sm mx-auto">
                    {t('onboarding.setup.subtitle')}
                </p>
            </div>

            <div className="flex flex-col gap-4 max-w-lg mx-auto">
                {steps.map((step, index) => (
                    <div 
                        key={step.id} 
                        onClick={() => navigate(step.path)}
                        className={`setup-card ${step.completed ? 'completed' : ''}`}
                    >
                        <div className="setup-card-icon">
                            {step.completed ? <CheckCircle2 size={24} className="text-emerald-500" /> : step.icon}
                        </div>
                        <div className="setup-card-content">
                            <h4 className="setup-card-title">{index + 1}. {step.title}</h4>
                            <p className="setup-card-desc">{step.desc}</p>
                        </div>
                        <div className="setup-card-action">
                            <ChevronRight size={20} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-12 text-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 max-w-md mx-auto">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Need help?</p>
                <p className="text-sm text-slate-500 mb-4">You can explore with demo data before finishing your setup.</p>
                {/* The Start Demo button is handled by parent App.jsx */}
            </div>
        </div>
    );
};

export default SetupChecklist;
