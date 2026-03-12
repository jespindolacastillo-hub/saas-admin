const saved = typeof window !== 'undefined' ? localStorage.getItem('saas_tenant_config') : null;
const parsed = saved ? JSON.parse(saved) : {};

export const tenantConfig = {
    id: parsed.id || '00000000-0000-0000-0000-000000000000',
    name: parsed.name || 'SaaS Platform',
    logoUrl: parsed.logoUrl || '/logo.png',
    primaryColor: parsed.primaryColor || '#2563eb',
    allowedDomains: ['priceshoes.com', 'priceshoes.mx', 'saas.com', 'gmail.com'],
    supportEmail: 'admin@saas.com',
    feedbackUrl: import.meta.env.VITE_FEEDBACK_URL || 'http://localhost:5174/feedback'
};

if (typeof window !== 'undefined' && tenantConfig.primaryColor) {
    document.documentElement.style.setProperty('--primary', tenantConfig.primaryColor);
}
