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
      const tid = userData?.tenant_id || getTenantId();
      
      const cleanTid = uuidRegex.test(tid) ? tid : '00000000-0000-0000-0000-000000000000';

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
