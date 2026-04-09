import { supabase } from '../lib/supabase';

/**
 * dataService.js
 * Centralized service to handle hybrid data fetching (Legacy vs Modern)
 * Normalizes all records to a modern JSON schema.
 */

const normalizeFeedback = (f, table) => ({
  ...f,
  _table: table,
  location_id: f.location_id || f.tienda_id,
  score: f.score ?? f.satisfaccion ?? 0,
  comment: f.comment || f.comentario || '',
  created_at: f.created_at
});

export const dataService = {
  /**
   * Fetches and normalizes feedbacks from both modern and legacy tables.
   */
  async fetchFeedbacks(tenantId, isTest = false) {
    if (!tenantId) return [];

    try {
      const [modernRes, legacyRes] = await Promise.all([
        supabase.from('feedbacks')
          .select('id, location_id, qr_id, score, comment, followup_answer, contact_phone, created_at, recovery_status, recovery_at, recovery_actor, recovery_resolved_at, coupon_code, coupon_redeemed, coupon_redeemed_at, coupon_redeemed_by, coupon_not_returned, recovery_sent, is_test, redeemed_amount, applied_discount_pct, coupon_config_id, routed_to_google, google_click_at')
          .eq('tenant_id', tenantId)
          .eq('is_test', isTest),
        supabase.from('Feedback')
          .select('id, tienda_id, satisfaccion, comentario, created_at')
          .eq('tenant_id', tenantId)
      ]);

      const modern = (modernRes.data || []).map(f => normalizeFeedback(f, 'feedbacks'));
      const legacy = (legacyRes.data || []).map(f => ({ ...normalizeFeedback(f, 'Feedback'), is_test: false }));

      console.log(`📊 [Data] Feedbacks: Modern=${modern.length}, Legacy=${legacy.length}`);

      return [...modern, ...legacy].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
      console.error('dataService.fetchFeedbacks error:', error);
      return [];
    }
  },

  /**
   * Fetches and normalizes stores/locations from both modern and legacy tables.
   */
  async fetchStores(tenantId) {
    if (!tenantId) return [];

    try {
      const [modernRes, legacyRes] = await Promise.all([
        supabase.from('locations')
          .select('id, name, address, lat, lng, google_review_url, whatsapp_number')
          .eq('tenant_id', tenantId),
        supabase.from('Tiendas_Catalogo')
          .select('id, nombre, lat, lng, direccion, ciudad')
          .eq('tenant_id', tenantId)
      ]);

      const modern = (modernRes.data || []).map(s => ({
        ...s,
        source: 'modern',
        nombre: s.name // compatibility
      }));

      const legacy = (legacyRes.data || []).map(s => ({
        ...s,
        name: s.nombre,
        address: s.direccion || s.ciudad,
        source: 'legacy',
        nombre: s.nombre
      }));

      // Merge by ID or Name to avoid duplicates if possible
      const storesMap = new Map();
      legacy.forEach(s => storesMap.set(s.id, s));
      modern.forEach(s => {
        storesMap.set(s.id, s); 
      });

      const finalStores = Array.from(storesMap.values());
      console.log(`📊 [Data] Stores resolved: ${finalStores.length}`);
      return finalStores;
    } catch (error) {
      console.error('dataService.fetchStores error:', error);
      return [];
    }
  },

  /**
   * Fetches catalog areas/categories.
   */
  async fetchAreas(tenantId) {
    if (!tenantId) return [];
    const { data } = await supabase.from('Areas_Catalogo').select('*').eq('tenant_id', tenantId);
    return data || [];
  }
};
