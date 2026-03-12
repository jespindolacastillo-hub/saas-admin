import React, { useState, useEffect } from 'react';
import { tenantConfig } from '../../config/tenant';
import { Save, Upload, Palette, Building } from 'lucide-react';

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

    const handleSave = () => {
        localStorage.setItem('saas_tenant_config', JSON.stringify(config));
        
        // Update CSS variable for primary color dynamically
        if (config.primaryColor) {
            document.documentElement.style.setProperty('--primary', config.primaryColor);
        }
        
        alert('Configuración guardada localmente. En una app real, esto se guardaría en la tabla "tenants" de la base de datos.');
        window.location.reload();
    };

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
        </div>
    );
};

export default OrganizationSettings;
