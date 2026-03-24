import { supabase } from '../lib/supabase';

export const AffiliateService = {
  async list() {
    const { data, error } = await supabase
      .from('affiliates')
      .select('*, upline:upline_id(id, name, ref_code)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async get(id) {
    const { data, error } = await supabase
      .from('affiliates')
      .select('*, upline:upline_id(id, name, ref_code)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async save(affiliate) {
    const { id, ...payload } = affiliate;
    if (id) {
      const { data, error } = await supabase
        .from('affiliates')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('affiliates')
        .insert({ ...payload, ref_code: payload.ref_code || generateRefCode(payload.name) })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async toggleActive(id, active) {
    const { error } = await supabase
      .from('affiliates')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  // Tenants referred by this affiliate
  async getReferredTenants(affiliateId) {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, plan, plan_status, mrr, created_at')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Commission ledger for an affiliate
  async getLedger(affiliateId) {
    const { data, error } = await supabase
      .from('commission_ledger')
      .select('*, tenant:tenant_id(name)')
      .eq('affiliate_id', affiliateId)
      .order('period', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Mark commissions as paid
  async markPaid(ids) {
    const { error } = await supabase
      .from('commission_ledger')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .in('id', ids);
    if (error) throw error;
  },

  // Aggregate stats across all affiliates
  async getStats() {
    const { data, error } = await supabase
      .from('commission_ledger')
      .select('affiliate_id, amount, status, period');
    if (error) throw error;
    return data || [];
  },
};

function generateRefCode(name = '') {
  const base = name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return (base + suffix).toUpperCase();
}
