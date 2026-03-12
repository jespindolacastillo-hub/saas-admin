export const PLAN_LIMITS = {
    starter: {
        name: 'Starter (Gratis)',
        maxStores: 1,
        maxAreas: 3,
        maxMonthlyResponses: 50,
        customBranding: false,
        prioritySupport: false
    },
    growth: {
        name: 'Growth',
        maxStores: 5,
        maxAreas: 999,
        maxMonthlyResponses: 500,
        customBranding: true,
        prioritySupport: false
    },
    pro: {
        name: 'Pro',
        maxStores: 999,
        maxAreas: 999,
        maxMonthlyResponses: 999999,
        customBranding: true,
        prioritySupport: true
    },
    enterprise: {
        name: 'Enterprise',
        maxStores: 999,
        maxAreas: 999,
        maxMonthlyResponses: 999999,
        customBranding: true,
        prioritySupport: true,
        isCustom: true
    }
};

export const checkLimit = (currentCount, limit) => {
    return currentCount < limit;
};
