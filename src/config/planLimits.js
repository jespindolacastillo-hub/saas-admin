export const PLAN_LIMITS = {
    starter: {
        name: 'Starter',
        price: '0',
        description: 'Ideal para pequeños negocios empezando su camino.',
        maxStores: 1,
        maxAreas: 3,
        maxMonthlyResponses: 50,
        customBranding: false,
        prioritySupport: false,
        features: ['1 Sucursal', 'Hasta 3 Áreas', '50 Respuestas/mes']
    },
    growth: {
        name: 'Growth',
        price: '29',
        description: 'Perfecto para empresas en expansión con múltiples puntos.',
        maxStores: 5,
        maxAreas: 999,
        maxMonthlyResponses: 500,
        customBranding: true,
        prioritySupport: false,
        features: ['5 Sucursales', 'Áreas Ilimitadas', '500 Respuestas/mes', 'Branding Personalizado']
    },
    pro: {
        name: 'Pro',
        price: '79',
        description: 'Para organizaciones grandes que buscan control total.',
        maxStores: 999,
        maxAreas: 999,
        maxMonthlyResponses: 999999,
        customBranding: true,
        prioritySupport: true,
        features: ['Sucursales Ilimitadas', 'Áreas Ilimitadas', 'Respuestas Ilimitadas', 'Soporte Prioritario']
    },
    enterprise: {
        name: 'Enterprise',
        price: 'Custom',
        description: 'Soluciones a medida para corporativos globales.',
        maxStores: 999,
        maxAreas: 999,
        maxMonthlyResponses: 999999,
        customBranding: true,
        prioritySupport: true,
        isCustom: true,
        features: ['Infraestructura Dedicada', 'SLA Garantizado', 'Manager de Cuenta']
    }
};

export const checkLimit = (currentCount, limit) => {
    return currentCount < limit;
};
