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
        <div className="animate-in fade-in duration-500" style={{ paddingBottom: '4rem' }}>
            <header style={{ marginBottom: '2.5rem' }}>
                <h1 style={{ fontFamily: 'Outfit', fontSize: '2rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>Configuración de Organización</h1>
                <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Gestiona la identidad corporativa y el nivel de suscripción de tu plataforma.</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                
                {/* Profile Settings Section */}
                <section>
                    <div className="card shadow-sm" style={{ border: '1px solid #e2e8f0', background: 'white' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b' }}>
                            <Building size={20} className="text-primary" /> Perfil Visual
                        </h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
                            <div className="form-group">
                                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem', display: 'block' }}>Nombre de la Empresa</label>
                                <input name="name" value={config.name || ''} onChange={handleChange} className="input" placeholder="Ej. Mi Empresa SaaS" style={{ fontSize: '0.9rem' }} />
                            </div>

                            <div className="form-group">
                                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem', display: 'block' }}>Color de Marca</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <input type="color" name="primaryColor" value={config.primaryColor || '#2563eb'} onChange={handleChange} style={{ height: 42, width: 80, cursor: 'pointer', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '2px' }} />
                                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontFamily: 'monospace' }}>{config.primaryColor}</span>
                                </div>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem', display: 'block' }}>Logotipo Principal</label>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
                                <div style={{ width: '120px', height: '120px', background: '#f8fafc', border: '2px dashed #e2e8f0', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '12px', transition: 'all 0.3s ease' }}>
                                    {logoPreview ? <img src={logoPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Sin logo</span>}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <input type="file" accept="image/*" id="logoUpload" style={{ display: 'none' }} onChange={handleLogoUpload} />
                                    <label htmlFor="logoUpload" className="btn btn-secondary" style={{ cursor: 'pointer', padding: '8px 16px', fontSize: '0.85rem' }}>Cambiar Imagen</label>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '10px', lineHeight: '1.4' }}>Sube una imagen con fondo transparente. Tamaño recomendado: 400x400px.</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={handleSave} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontWeight: '600' }}>
                                <Save size={18} /> Guardar Cambios
                            </button>
                        </div>
                    </div>
                </section>

                {/* Pricing Grid Section */}
                <section style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontFamily: 'Outfit', fontSize: '1.4rem', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Crown size={24} className="text-primary" /> Planes y Suscripción
                        </h2>
                        <div style={{ background: '#f1f5f9', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', color: '#475569' }}>
                            Facturación Mensual
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {Object.entries(PLAN_LIMITS).filter(([key]) => key !== 'enterprise').map(([key, plan]) => {
                            const isCurrent = config.plan === key;
                            
                            return (
                                <div 
                                    key={key} 
                                    className={`card ${isCurrent ? 'shadow-lg' : 'shadow-sm'}`} 
                                    style={{ 
                                        position: 'relative',
                                        border: isCurrent ? '2px solid var(--primary)' : '1px solid #e2e8f0', 
                                        padding: '2rem',
                                        background: isCurrent ? 'linear-gradient(to bottom right, #ffffff, #f8faff)' : 'white',
                                        transition: 'all 0.3s ease',
                                        transform: isCurrent ? 'translateY(-5px)' : 'none'
                                    }}
                                >
                                    {isCurrent && (
                                        <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: 'white', padding: '4px 16px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.05em', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                            PLAN ACTUAL
                                        </div>
                                    )}

                                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem', color: '#0f172a' }}>{plan.name}</h3>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', minHeight: '40px', marginBottom: '1.5rem', lineHeight: '1.5' }}>{plan.description}</p>
                                    
                                    <div style={{ marginBottom: '2rem' }}>
                                        <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0f172a' }}>${plan.price}</span>
                                        <span style={{ color: '#94a3b8', fontWeight: '600' }}> /mes</span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
                                        {plan.features.map((feature, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#334155' }}>
                                                <div style={{ background: isCurrent ? 'var(--primary)' : '#e2e8f0', color: isCurrent ? 'white' : '#94a3b8', borderRadius: '50%', padding: '2px' }}>
                                                    <CheckCircle2 size={14} />
                                                </div>
                                                {feature}
                                            </div>
                                        ))}
                                    </div>

                                    <button 
                                        disabled={isCurrent}
                                        onClick={isCurrent ? null : handleUpgrade}
                                        className={`btn ${isCurrent ? 'btn-secondary' : 'btn-primary'}`}
                                        style={{ 
                                            width: '100%', 
                                            padding: '14px', 
                                            borderRadius: '12px', 
                                            fontWeight: '700',
                                            fontSize: '0.95rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            opacity: isCurrent ? 0.7 : 1,
                                            cursor: isCurrent ? 'default' : 'pointer',
                                            background: isCurrent ? '#f1f5f9' : null,
                                            color: isCurrent ? '#94a3b8' : null
                                        }}
                                    >
                                        {isCurrent ? 'Plan Activo' : key === 'starter' ? 'Cambiar a este' : <><Zap size={18} /> Mejorar Ahora</>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Enterprise Banner */}
                    <div style={{ marginTop: '2rem', padding: '2rem', borderRadius: '20px', background: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px' }}>
                                <Building size={32} color="#94a3b8" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '4px' }}>Enterprise</h3>
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Personalización extrema y soporte 24/7 para equipos globales.</p>
                            </div>
                        </div>
                        <button className="btn btn-secondary" style={{ background: 'white', color: '#0f172a', fontWeight: '700', padding: '10px 24px' }}>
                            Contactar Ventas
                        </button>
                    </div>
                </section>

            </div>
        </div>
    );
};

export default OrganizationSettings;
