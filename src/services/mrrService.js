import { supabase } from '../lib/supabase';
import { getEffectivePrice } from '../config/planLimits';

/**
 * Recalcula tenants.mrr = getEffectivePrice(zone, plan, billing) × nº sucursales activas.
 * Llámalo después de cualquier cambio que afecte stores o plan.
 */
export async function refreshMRR(tenantId) {
  if (!tenantId || tenantId === '00000000-0000-0000-0000-000000000000') return;

  try {
    // 1. Obtener datos del tenant
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('plan, zone, billing, plan_status')
      .eq('id', tenantId)
      .single();
    if (tErr || !tenant) return;

    // Trial → mrr = 0
    if (tenant.plan_status === 'trial') {
      await supabase.from('tenants').update({ mrr: 0 }).eq('id', tenantId);
      return;
    }

    // 2. Contar sucursales activas
    const { count } = await supabase
      .from('Tiendas_Catalogo')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const storeCount = count || 0;
    if (storeCount === 0) {
      await supabase.from('tenants').update({ mrr: 0 }).eq('id', tenantId);
      return;
    }

    // 3. Calcular precio efectivo por sucursal (respeta descuentos activos)
    const zone    = tenant.zone    || 'mx';
    const plan    = tenant.plan    || 'starter';
    const billing = tenant.billing || 'monthly';
    const pricePerStore = getEffectivePrice(zone, plan, billing);
    const mrr = pricePerStore * storeCount;

    // 4. Guardar
    await supabase.from('tenants').update({ mrr }).eq('id', tenantId);
  } catch (e) {
    console.warn('refreshMRR error:', e.message);
  }
}
