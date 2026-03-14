import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getTenantId } from '../config/tenant';

/**
 * useTenant Hook: Centralized identity and synchronization.
 * Ensures the tenant_id is always a valid UUID and stays in sync with the session.
 */
export const useTenant = () => {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const sync = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTenant(null);
        return;
      }

      // 2. Resolve tenant_id from database (Usuarios Table)
      const { data: userData, error: userError } = await supabase
        .from('Usuarios')
        .select('tenant_id')
        .eq('email', user.email)
        .maybeSingle();

      if (userError) {
        console.warn('User identity not found in Usuarios table. Falling back to default.');
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      // Strict rule: If user does not exist in DB, force zero UUID to trigger onboarding
      let cleanTid = '00000000-0000-0000-0000-000000000000';
      
      if (userData?.tenant_id && uuidRegex.test(userData.tenant_id)) {
        cleanTid = userData.tenant_id;
      } else if (getTenantId() && uuidRegex.test(getTenantId())) {
          // Allow fallback to cache ONLY if they have valid token but somehow lost DB link
          // But actually, for new signups, userData is null, so it would skip to here!
          // We MUST NOT fall back to getTenantId() if it's a NEW user without a tenant in DB.
          console.warn("New user without DB tenant, forcing zero UUID instead of cache.");
      }

      // 3. Fetch full metadata
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', cleanTid)
        .single();

      const finalTenant = {
        id: cleanTid,
        name: tenantData?.name || 'Empresa',
        logoUrl: tenantData?.logo_url,
        plan: tenantData?.plan || 'starter',
        ...(tenantData || {})
      };

      setTenant(finalTenant);
      localStorage.setItem('saas_tenant_config', JSON.stringify(finalTenant));
    } catch (err) {
      console.error('Identity sync error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    sync();
  }, []);

  return { tenant, loading, error, refresh: sync };
};
