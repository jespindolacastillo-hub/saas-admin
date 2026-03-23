const PRICING_API = 'https://qdbosheknbgyqhtoxmfv.supabase.co/functions/v1/get-pricing';

// Cache en memoria para la sesión
let _cache = null;

export async function fetchPricing() {
  if (_cache) return _cache;
  try {
    const res = await fetch(PRICING_API);
    const data = await res.json();
    _cache = data;
    return data;
  } catch {
    return null;
  }
}

// Precios por zona — precio por sucursal/mes
// msrp = precio público · floor = piso mínimo (nunca vender por debajo)
export const PRICING_ZONES = {
  mx: {
    sym: '$', cur: 'MXN',
    starter: { msrp: 599,   floor: 349,  ann_msrp: 479,  ann_floor: 279  },
    growth:  { msrp: 999,   floor: 599,  ann_msrp: 799,  ann_floor: 479  },
  },
  usd: {
    sym: '$', cur: 'USD',
    starter: { msrp: 49,    floor: 29,   ann_msrp: 39,   ann_floor: 23   },
    growth:  { msrp: 79,    floor: 49,   ann_msrp: 63,   ann_floor: 39   },
  },
  br: {
    sym: 'R$', cur: 'BRL',
    starter: { msrp: 249,   floor: 149,  ann_msrp: 199,  ann_floor: 119  },
    growth:  { msrp: 399,   floor: 249,  ann_msrp: 319,  ann_floor: 199  },
  },
};

// Descuentos activos — primer match por plan gana
// type:'floor' → usa precio piso · type:'pct' → MSRP * (1 - pct), mínimo floor
export const ACTIVE_DISCOUNTS = [
  { id: 'launch',
    ends: new Date('2026-03-30T06:00:00Z'),
    label: { es: 'Precio de lanzamiento', en: 'Launch price', pt: 'Preço de lançamento' },
    type: 'floor', plans: ['starter', 'growth'] },
  // Ejemplo futuro:
  // { id:'bfcm', ends:new Date('2026-12-01'),
  //   label:{es:'Black Friday',en:'Black Friday',pt:'Black Friday'},
  //   type:'pct', pct:0.25, plans:['starter','growth'] },
];

export function getActiveDiscount(plan) {
  const now = new Date();
  return ACTIVE_DISCOUNTS.find(d => d.ends > now && d.plans.includes(plan)) || null;
}

export function getEffectivePrice(zone, plan, billing = 'monthly') {
  const p = PRICING_ZONES[zone]?.[plan]; if (!p) return 0;
  const d = getActiveDiscount(plan);
  const isAnn = billing === 'annual';
  const msrp  = isAnn ? p.ann_msrp  : p.msrp;
  const floor = isAnn ? p.ann_floor : p.floor;
  if (!d) return msrp;
  if (d.type === 'floor') return floor;
  if (d.type === 'pct')   return Math.max(floor, Math.round(msrp * (1 - d.pct)));
  return floor;
}

// Fallback estático para límites de plan (no cambian por zona)
export const PLAN_LIMITS = {
  trial: {
    slug: 'trial', name: 'Trial',
    price_monthly: 0, whatsapp_limit: 20, users_limit: 2, trial_days: 14,
    features: ['Acceso completo 14 días', 'Sin tarjeta de crédito'],
  },
  starter: {
    slug: 'starter', name: 'Starter',
    // MXN reference (usar getEffectivePrice para precio real por zona)
    price_monthly: 599, price_annual: 479,
    price_floor_monthly: 349, price_floor_annual: 279,
    whatsapp_limit: 50, users_limit: 2,
    features: ['Feedbacks ilimitados', 'QR codes ilimitados', 'Dashboard + alertas', 'Email campañas incluido', 'WhatsApp 50 alertas/mes', '2 usuarios'],
  },
  growth: {
    slug: 'growth', name: 'Growth',
    price_monthly: 999, price_annual: 799,
    price_floor_monthly: 599, price_floor_annual: 479,
    whatsapp_limit: 200, users_limit: null,
    features: ['Todo Starter +', 'WhatsApp 200 alertas/mes', 'Campañas masivas', 'Mapa geográfico', 'Leaderboard', 'Usuarios ilimitados'],
  },
  enterprise: {
    slug: 'enterprise', name: 'Enterprise',
    price_monthly: null, price_annual: null, whatsapp_limit: -1, users_limit: null,
    features: ['Todo Growth +', 'WhatsApp ilimitado', 'Onboarding dedicado', 'API + webhooks', 'SLA 99.9%'],
  },
};

export const getPlanLimits = (slug) => PLAN_LIMITS[slug] ?? PLAN_LIMITS.trial;

// true si el plan tiene WhatsApp
export const planHasWhatsapp = (slug) => {
  const plan = getPlanLimits(slug);
  return plan.whatsapp_limit !== 0;
};

// true si está en trial activo
export const isActiveTrial = (tenant) => {
  if (!tenant?.trial_ends_at) return false;
  return new Date(tenant.trial_ends_at) > new Date() && tenant.plan_status === 'trial';
};

// Días restantes de trial
export const trialDaysLeft = (tenant) => {
  if (!tenant?.trial_ends_at) return 0;
  const diff = new Date(tenant.trial_ends_at) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// true si el tenant puede usar WhatsApp
export const canUseWhatsapp = (tenant, usedThisMonth = 0) => {
  if (isActiveTrial(tenant)) return usedThisMonth < 20;
  const plan = getPlanLimits(tenant?.plan);
  if (plan.whatsapp_limit === -1) return true;   // ilimitado
  if (plan.whatsapp_limit === 0) return false;   // bloqueado
  return usedThisMonth < plan.whatsapp_limit;
};

// Porcentaje de uso (0-100)
export const limitPct = (current, max) =>
  !max || max < 0 ? 0 : Math.min(100, Math.round((current / max) * 100));

// Compatibilidad con código anterior
export const withinLimit = (current, max) => !max || max >= 999999 || max < 0 || current < max;
