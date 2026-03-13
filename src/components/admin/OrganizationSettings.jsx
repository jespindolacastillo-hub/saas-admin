import React, { useState, useEffect } from 'react';
import { tenantConfig } from '../../config/tenant';
import { Save, Upload, Palette, Building, Crown, Zap, CheckCircle2 } from 'lucide-react';
import { PLAN_LIMITS } from '../../config/planLimits';
import { supabase } from '../../lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { useTranslation } from 'react-i18next';

const OrganizationSettings = () => {
    const { t, i18n } = useTranslation();
    const [config, setConfig] = useState(tenantConfig);
    const [logoPreview, setLogoPreview] = useState(tenantConfig.logoUrl);

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    useEffect(() => {
        const saved = localStorage.getItem('saas_tenant_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            setConfig(parsed);
            setLogoPreview(parsed.logoUrl);
        }
    }, []);

    const handleChange = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result);
                setConfig({ ...config, logoUrl: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    useEffect(() => {
        const syncTenantData = async () => {
            try {
                // 1. Get current user
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // 2. Get user's tenant_id from Usuarios table
                const { data: userData, error: userError } = await supabase
                    .from('Usuarios')
                    .select('tenant_id')
                    .eq('email', user.email)
                    .single();

                const effectiveTenantId = userData?.tenant_id || tenantConfig.id;

                // 3. Fetch tenant data
                const { data, error } = await supabase
                    .from('tenants')
                    .select('*')
                    .eq('id', effectiveTenantId)
                    .single();

                if (error) throw error;
                if (data) {
                    console.log('Sync result:', data);
                    const newConfig = {
                        ...config,
                        id: data.id,
                        name: data.name,
                        logoUrl: data.logo_url,
                        primaryColor: data.primary_color, // FIXED: was primary_color
                        plan: data.plan,
                        subscriptionStatus: data.subscription_status
                    };
                    setConfig(newConfig);
                    localStorage.setItem('saas_tenant_config', JSON.stringify(newConfig));
                    
                    // Update theme color
                    if (data.primary_color) {
                        document.documentElement.style.setProperty('--primary', data.primary_color);
                    }
                } else {
                    console.warn('No tenant data found for ID:', effectiveTenantId);
                }
            } catch (err) {
                console.error('Error syncing tenant data:', err);
            }
        };

        syncTenantData();

        const params = new URLSearchParams(window.location.search);
        if (params.get('success')) {
            console.log('Payment success detected, syncing data in 3s...');
            setTimeout(syncTenantData, 3000);
        }
    }, []);

    const handleSave = async () => {
        try {
            // Update in Supabase
            const { error } = await supabase
                .from('tenants')
                .update({
                    name: config.name,
                    logo_url: config.logoUrl,
                    primary_color: config.primaryColor
                })
                .eq('id', tenantConfig.id);

            if (error) throw error;

            localStorage.setItem('saas_tenant_config', JSON.stringify(config));
            
            // Update CSS variable for primary color dynamically
            if (config.primaryColor) {
                document.documentElement.style.setProperty('--primary', config.primaryColor);
            }
            
            alert(t('settings.save_success'));
            window.location.reload();
        } catch (err) {
            alert(t('settings.save_error') + ': ' + err.message);
        }
    };

    const handleUpgrade = async () => {
        try {
            const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
            if (!stripeKey) throw new Error('Stripe Publishable Key missing');
            
            const stripe = await loadStripe(stripeKey);
            
            // Call Supabase Edge Function to create Checkout Session
            const { data, error } = await supabase.functions.invoke('stripe-checkout', {
                body: { 
                    tenant_id: tenantConfig.id,
                    plan: 'growth',
                    user_email: (await supabase.auth.getUser()).data.user?.email
                }
            });

            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No checkout URL returned from server');
            }
        } catch (err) {
            console.error('Stripe Error:', err);
            alert(`${t('settings.payment_error')}: ${err.message}`);
        }
    };

    const currentPlanLimit = PLAN_LIMITS[config.plan] || PLAN_LIMITS.starter;

    return (
        <div className="animate-in fade-in duration-700" style={{ paddingBottom: '6rem', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '3.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '2rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ background: 'var(--primary)', width: '32px', height: '6px', borderRadius: '3px' }}></div>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('settings.administration', 'ADMINISTRACIÓN')}</span>
                    </div>
                    <h1 style={{ fontFamily: 'Outfit', fontSize: '2.5rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.03em', lineHeight: '1.1' }}>{t('settings.title')}</h1>
                    <p style={{ color: '#64748b', fontSize: '1rem', marginTop: '0.5rem', fontWeight: '500' }}>{t('settings.subtitle')}</p>
                </div>
                
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4rem' }}>
                
                {/* Profile Settings Section */}
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem', alignItems: 'start' }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', marginBottom: '1rem' }}>{t('settings.visual_identity')}</h3>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: '1.6', marginBottom: '2rem' }}>{t('settings.visual_identity_desc')}</p>
                        
                        <div className="card shadow-sm" style={{ border: '1px solid #e2e8f0', background: 'white', padding: '1.5rem' }}>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '0.6rem', display: 'block', textTransform: 'uppercase' }}>{t('settings.org_name')}</label>
                                <input name="name" value={config.name || ''} onChange={handleChange} className="input" placeholder="Ej. Ultra Mobile Solutions" style={{ fontSize: '0.95rem', padding: '12px' }} />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '0.6rem', display: 'block', textTransform: 'uppercase' }}>{t('settings.corporate_color')}</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <input type="color" name="primaryColor" value={config.primaryColor || '#2563eb'} onChange={handleChange} style={{ height: 40, width: 60, cursor: 'pointer', borderRadius: '6px', border: 'none', background: 'transparent' }} />
                                    <span style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: '700', fontFamily: 'monospace' }}>{config.primaryColor?.toUpperCase()}</span>
                                </div>
                            </div>

                            <button onClick={handleSave} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', fontWeight: '700', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.2)' }}>
                                <Save size={20} /> {t('settings.save_identity')}
                            </button>
                        </div>
                    </div>

                    <div className="card shadow-sm" style={{ border: '1px solid #e2e8f0', background: 'white', padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', marginBottom: '1.5rem', display: 'block', textTransform: 'uppercase' }}>{t('settings.brand_logo')}</label>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
                            <div style={{ width: '100%', maxWidth: '200px', aspectRatio: '1', background: '#f1f5f9', border: '2px dashed #cbd5e1', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '20px', position: 'relative', transition: 'all 0.4s ease' }}>
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                ) : (
                                    <div style={{ textAlign: 'center' }}>
                                        <Upload size={32} color="#94a3b8" style={{ marginBottom: '10px' }} />
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('settings.brand_logo_placeholder', 'Sube tu logo')}</p>
                                    </div>
                                )}
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <input type="file" accept="image/*" id="logoUpload" style={{ display: 'none' }} onChange={handleLogoUpload} />
                                <label htmlFor="logoUpload" className="btn btn-secondary" style={{ cursor: 'pointer', padding: '10px 24px', fontSize: '0.9rem', fontWeight: '700' }}>{t('settings.select_file')}</label>
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '12px' }}>{t('settings.supported_formats')}</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Subscriptions Section */}
                <section>
                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                        <h2 style={{ fontFamily: 'Outfit', fontSize: '2rem', fontWeight: '800', color: '#0f172a', marginBottom: '1rem' }}>{t('settings.scale_potential')}</h2>
                        <p style={{ fontSize: '1.1rem', color: '#64748b', maxWidth: '600px', margin: '0 auto' }}>{t('settings.choose_plan')}</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', alignItems: 'stretch' }}>
                        {Object.entries(PLAN_LIMITS).filter(([key]) => key !== 'enterprise').map(([key, plan]) => {
                            const isCurrent = config.plan === key;
                            const isGrowth = key === 'growth';
                            
                            return (
                                <div 
                                    key={key} 
                                    className={`card ${isCurrent ? 'shadow-xl' : 'shadow-sm'}`} 
                                    style={{ 
                                        display: 'flex',
                                        flexDirection: 'column',
                                        position: 'relative',
                                        border: isCurrent ? '3px solid var(--primary)' : '1px solid #e2e8f0', 
                                        padding: '2rem 1.75rem',
                                        borderRadius: '24px',
                                        background: isCurrent ? '#fdfdfd' : 'white',
                                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                        overflow: 'hidden',
                                        height: '100%'
                                    }}
                                >
                                    {isCurrent && (
                                        <div style={{ position: 'absolute', top: '16px', right: '-35px', transform: 'rotate(45deg)', background: 'var(--primary)', color: 'white', width: '140px', textAlign: 'center', fontSize: '0.65rem', fontWeight: '900', padding: '4px 0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 10 }}>
                                            {t('settings.your_plan')}
                                        </div>
                                    )}

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '0.5rem', color: isCurrent ? 'var(--primary)' : '#0f172a', letterSpacing: '-0.02em' }}>{plan.name}</h3>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                            <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0f172a' }}>${plan.price}</span>
                                            <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: '600' }}>/mes</span>
                                        </div>
                                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.75rem', lineHeight: '1.5', minHeight: '3rem' }}>{t(`plans.${key}.description`, plan.description)}</p>
                                    </div>

                                    <div style={{ flex: 1, marginBottom: '2rem' }}>
                                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>{t('settings.includes')}</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {plan.features.map((feature, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem', color: '#334155', fontWeight: '500' }}>
                                                    <div style={{ marginTop: '2px', background: isCurrent ? 'var(--primary)' : '#f1f5f9', color: isCurrent ? 'white' : '#94a3b8', borderRadius: '50%', padding: '2px' }}>
                                                        <CheckCircle2 size={12} strokeWidth={3} />
                                                    </div>
                                                    {t(`plans.features.${feature.replace(/\s/g, '_').toLowerCase()}`, feature)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <button 
                                        disabled={isCurrent}
                                        onClick={isCurrent ? null : handleUpgrade}
                                        className="btn"
                                        style={{ 
                                            width: '100%', 
                                            padding: '14px', 
                                            borderRadius: '14px', 
                                            fontWeight: '800',
                                            fontSize: '0.9rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'all 0.3s ease',
                                            background: isCurrent ? '#f1f5f9' : (isGrowth ? 'var(--primary)' : '#0f172a'),
                                            color: isCurrent ? '#94a3b8' : 'white',
                                            border: 'none',
                                            boxShadow: isCurrent ? 'none' : '0 8px 16px -4px rgba(0,0,0,0.1)',
                                            cursor: isCurrent ? 'default' : 'pointer'
                                        }}
                                    >
                                        {isCurrent ? t('settings.active_plan') : (key === 'starter' ? t('settings.choose_starter') : <><Zap size={18} fill="currentColor" /> {t('settings.upgrade_plan')}</>)}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Premium Enterprise Section */}
                    <div style={{ marginTop: '4rem', padding: '3rem', borderRadius: '32px', background: '#0f172a', position: 'relative', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px', background: 'var(--primary)', filter: 'blur(80px)', opacity: '0.15' }}></div>
                        
                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
                            <div style={{ maxWidth: '500px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.1)', width: 'fit-content', padding: '6px 16px', borderRadius: '20px', color: '#94a3b8', fontSize: '0.7rem', fontWeight: '800', marginBottom: '1.5rem', textTransform: 'uppercase' }}>{t('settings.consult_expert', 'Consulte un especialista')}</div>
                                <h3 style={{ fontSize: '2rem', fontWeight: '800', color: 'white', marginBottom: '1rem', letterSpacing: '-0.02em' }}>{t('settings.enterprise_title')}</h3>
                                <p style={{ fontSize: '1rem', color: '#94a3b8', lineHeight: '1.6' }}>{t('settings.enterprise_desc')}</p>
                            </div>
                            <button className="btn" style={{ background: 'white', color: '#0f172a', fontWeight: '800', padding: '16px 36px', borderRadius: '16px', fontSize: '1.05rem', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}>
                                {t('settings.contact_sales')}
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default OrganizationSettings;
