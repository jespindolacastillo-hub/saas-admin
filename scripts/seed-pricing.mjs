import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Lee el .env manualmente
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map((v, i) => i === 0 ? v.trim() : v.trim()))
);

const serviceKey = process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

if (!serviceKey) {
  console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(
  'https://qdbosheknbgyqhtoxmfv.supabase.co',
  serviceKey
);

const plans = [
  {
    slug: 'starter', name: 'Starter',
    price_monthly: 349, price_annual: 279,
    whatsapp_limit: 50, users_limit: 2, sort_order: 1,
    features: ['Feedbacks ilimitados','QR codes ilimitados','Dashboard + alertas en tiempo real','Email campañas incluido','WhatsApp 50 alertas/mes','2 usuarios','Soporte por email'],
  },
  {
    slug: 'growth', name: 'Growth',
    price_monthly: 599, price_annual: 479,
    whatsapp_limit: 200, users_limit: null, sort_order: 2,
    features: ['Todo Starter +','WhatsApp 200 alertas/mes','Campañas masivas email y WhatsApp','Mapa geográfico','Leaderboard de empleados','Usuarios ilimitados','Reportes exportables','Soporte prioritario'],
  },
  {
    slug: 'enterprise', name: 'Enterprise',
    price_monthly: null, price_annual: null,
    whatsapp_limit: -1, users_limit: null, sort_order: 3,
    features: ['Todo Growth +','WhatsApp ilimitado','Onboarding dedicado','API + webhooks','SLA 99.9%','Facturación personalizada'],
  },
];

const addons = [
  { slug: 'chico',   name: 'Paquete Chico',   messages_count: 100,  price: 149, sort_order: 1 },
  { slug: 'mediano', name: 'Paquete Mediano',  messages_count: 250,  price: 249, sort_order: 2 },
  { slug: 'grande',  name: 'Paquete Grande',   messages_count: 500,  price: 399, sort_order: 3 },
  { slug: 'empresa', name: 'Paquete Empresa',  messages_count: 1000, price: 699, sort_order: 4 },
];

const promoCodes = [
  {
    code: 'FOUNDER40', type: 'pct', value: 40,
    applies_to: 'all', billing_cycle: 'both',
    duration_months: 6, max_uses: 100,
    expires_at: '2026-06-30T23:59:59Z',
    description: 'Founding members - 40% off primeros 6 meses',
  },
];

async function seed() {
  console.log('Seeding pricing_plans...');
  const { error: e1 } = await supabase.from('pricing_plans').upsert(plans, { onConflict: 'slug' });
  if (e1) console.error('pricing_plans error:', e1.message);
  else console.log('✅ pricing_plans OK');

  console.log('Seeding whatsapp_addons...');
  const { error: e2 } = await supabase.from('whatsapp_addons').upsert(addons, { onConflict: 'slug' });
  if (e2) console.error('whatsapp_addons error:', e2.message);
  else console.log('✅ whatsapp_addons OK');

  console.log('Seeding promo_codes...');
  const { error: e3 } = await supabase.from('promo_codes').upsert(promoCodes, { onConflict: 'code' });
  if (e3) console.error('promo_codes error:', e3.message);
  else console.log('✅ promo_codes OK');
}

seed();
