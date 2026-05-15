import { supabase } from '../lib/supabase';

/**
 * dataService.js
 * Centralized service — queries only modern tables (feedbacks, locations).
 * Demo mode (makeDemoFeedbacks) is handled at the component level and is
 * purely for visualization; it is NOT handled here.
 */

export const dataService = {
  /**
   * Fetches feedbacks from the modern `feedbacks` table only.
   */
  async fetchFeedbacks(tenantId, isTest = false, { ignoreTestFilter = false } = {}) {
    if (!tenantId) return [];

    try {
      let query = supabase
        .from('feedbacks')
        .select('id, location_id, qr_id, score, comment, followup_answer, contact_phone, created_at, recovery_status, recovery_at, recovery_actor, recovery_resolved_at, coupon_code, coupon_redeemed, coupon_redeemed_at, coupon_redeemed_by, coupon_not_returned, recovery_sent, is_test, redeemed_amount, applied_discount_pct, coupon_config_id, routed_to_google, google_click_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (!ignoreTestFilter) query = query.eq('is_test', isTest);

      const { data, error } = await query;

      if (error) throw error;

      console.log(`📊 [Data] Feedbacks: ${(data || []).length}`);
      return data || [];
    } catch (error) {
      console.error('dataService.fetchFeedbacks error:', error);
      return [];
    }
  },

  /**
   * Fetches locations from the modern `locations` table only.
   */
  async fetchStores(tenantId) {
    if (!tenantId) return [];

    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, address, lat, lng, google_review_url, whatsapp_number')
        .eq('tenant_id', tenantId);

      if (error) throw error;

      // Deduplicate by name (case-insensitive) in case the table has duplicate rows
      const byName = new Map();
      (data || []).forEach(s => {
        const key = (s.name || '').toLowerCase().trim();
        if (!byName.has(key)) byName.set(key, s); // first row wins
      });

      const stores = Array.from(byName.values()).map(s => ({ ...s, nombre: s.name }));
      console.log(`📊 [Data] Stores: ${stores.length}`);
      return stores;
    } catch (error) {
      console.error('dataService.fetchStores error:', error);
      return [];
    }
  },


  /**
   * Fetches areas from the modern `areas` table (or Areas_Catalogo if still in use).
   */
  async fetchAreas(tenantId) {
    if (!tenantId) return [];
    const { data } = await supabase.from('Areas_Catalogo').select('*').eq('tenant_id', tenantId);
    return data || [];
  }
};
