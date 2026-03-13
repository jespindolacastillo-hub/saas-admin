const getSavedConfig = () => {
    if (typeof window === 'undefined') return {};
    try {
        const saved = localStorage.getItem('saas_tenant_config');
        return saved ? JSON.parse(saved) : {};
    } catch (_) {
        return {};
    }
};

export const getTenantId = () => {
    const config = getSavedConfig();
    const id = config.id || '00000000-0000-0000-0000-000000000000';
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id) ? id : '00000000-0000-0000-0000-000000000000';
};

export const tenantConfig = {
    get id() { return getTenantId(); },
    get name() { return getSavedConfig().name || 'SaaS Platform'; },
    get logoUrl() { return getSavedConfig().logoUrl || '/logo.png'; },
    get primaryColor() { return getSavedConfig().primaryColor || '#2563eb'; },
    get plan() { return getSavedConfig().plan || 'starter'; },
    get subscriptionStatus() { return getSavedConfig().subscriptionStatus || 'active'; },
    allowedDomains: ['*'],
    supportEmail: 'admin@saas-platform.com',
    feedbackUrl: 'https://priceshoes.netlify.app/feedback'
};

if (typeof window !== 'undefined') {
    const color = getSavedConfig().primaryColor || '#2563eb';
    document.documentElement.style.setProperty('--primary', color);
}
