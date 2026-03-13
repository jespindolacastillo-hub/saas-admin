import React, { useState, useEffect } from 'react';
import { tenantConfig } from '../../config/tenant';
import { Save, Upload, Palette, Building, Crown, Zap, CheckCircle2 } from 'lucide-react';
import { PLAN_LIMITS } from '../../config/planLimits';
import { supabase } from '../../lib/supabase';
import { loadStripe } from '@stripe/stripe-js';

const OrganizationSettings = () => {
    const [config, setConfig] = useState(tenantConfig);
    const [logoPreview, setLogoPreview] = useState(tenantConfig.logoUrl);

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
        // Fetch latest tenant data from Supabase to sync plan/settings
        const syncTenantData = async () => {
            try {
                const { data, error } = await supabase
                    .from('tenants')
                    .select('*')
                    .eq('id', tenantConfig.id)
                    .single();

                if (error) throw error;
                if (data) {
                    const newConfig = {
                        ...config,
                        name: data.name,
                        logoUrl: data.logo_url,
                        primaryColor: data.primary_color,
                        plan: data.plan,
                        subscriptionStatus: data.subscription_status
                    };
                    setConfig(newConfig);
                    localStorage.setItem('saas_tenant_config', JSON.stringify(newConfig));
                }
            } catch (err) {
                console.error('Error syncing tenant data:', err);
            }
        };

        syncTenantData();

        // Check for success in URL to show a welcome message
        const params = new URLSearchParams(window.location.search);
        if (params.get('success')) {
            // Check again after a short delay to give the webhook time to process
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
            
            alert('Configuración guardada exitosamente.');
            window.location.reload();
        } catch (err) {
            alert('Error al guardar: ' + err.message);
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
            alert('Error al iniciar pago: ' + err.message);
        }
    };

    const currentPlanLimit = PLAN_LIMITS[config.plan] || PLAN_LIMITS.starter;

    return (
        <div className="animate-in fade-in duration-500">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontFamily: 'Outfit', fontSize: '1.8rem', fontWeight: '700' }}>Organización (White-Label)</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Personaliza la apariencia de tu plataforma SaaS.</p>
            </header>

            <div className="card shadow-sm" style={{ maxWidth: '600px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}><Building size={16}/> Nombre de la Empresa</label>
                        <input name="name" value={config.name || ''} onChange={handleChange} className="input" placeholder="Ej. Mi Empresa SaaS" />
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}><Upload size={16}/> Logotipo</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '100px', height: '100px', background: '#f8fafc', border: '2px dashed #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '10px' }}>
                                {logoPreview ? <img src={logoPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Sin logo</span>}
                            </div>
                            <div>
                                <input type="file" accept="image/*" id="logoUpload" style={{ display: 'none' }} onChange={handleLogoUpload} />
                                <label htmlFor="logoUpload" className="btn btn-secondary" style={{ cursor: 'pointer' }}>Subir Imagen</label>
                                <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '8px' }}>Se recomienda PNG transparente.</p>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}><Palette size={16}/> Color Primario</label>
                        <input type="color" name="primaryColor" value={config.primaryColor || '#2563eb'} onChange={handleChange} style={{ height: 50, width: '100%', cursor: 'pointer', borderRadius: '8px', border: '2px solid #f1f5f9' }} />
                    </div>

                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', marginTop: '1rem' }}>
                        <button onClick={handleSave} className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', fontSize: '1rem', fontWeight: '700' }}>
                            <Save size={18} /> Guardar Cambios
                        </button>
                    </div>

                </div>
            </div>

            <div className="card shadow-sm" style={{ maxWidth: '600px', marginTop: '2rem', border: '1px solid #e0e7ff', background: 'linear-gradient(to bottom right, #ffffff, #f5f7ff)' }}>
                <header style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.2rem', fontWeight: '700', color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Crown size={20} color="#6366f1" /> Mi Plan Actual
                        </h2>
                        <p style={{ color: '#6366f1', fontSize: '0.8rem', fontWeight: '600' }}>Plan {currentPlanLimit.name}</p>
                    </div>
                    {config.plan === 'starter' && (
                        <div style={{ background: '#e0e7ff', color: '#4338ca', padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '700' }}>
                            GRATIS
                        </div>
                    )}
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>SUCURSALES</p>
                        <p style={{ fontSize: '1.2rem', fontWeight: '700' }}>{currentPlanLimit.maxStores === 999 ? '∞' : currentPlanLimit.maxStores}</p>
                    </div>
                    <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>ÁREAS / CATÁLOGO</p>
                        <p style={{ fontSize: '1.2rem', fontWeight: '700' }}>{currentPlanLimit.maxAreas === 999 ? '∞' : currentPlanLimit.maxAreas}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: currentPlanLimit.customBranding ? '#059669' : '#94a3b8' }}>
                        <CheckCircle2 size={16} /> Branding Personalizado
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: currentPlanLimit.prioritySupport ? '#059669' : '#94a3b8' }}>
                        <CheckCircle2 size={16} /> Soporte Prioritario
                    </div>
                </div>

                <button 
                  className="btn" 
                  style={{ 
                    width: '100%', 
                    background: 'linear-gradient(45deg, #4f46e5, #7c3aed)', 
                    color: 'white', 
                    border: 'none',
                    padding: '12px',
                    borderRadius: '12px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onClick={handleUpgrade}
                >
                    <Zap size={18} /> Mejorar mi Plan
                </button>
            </div>
        </div>
    );
};

export default OrganizationSettings;
