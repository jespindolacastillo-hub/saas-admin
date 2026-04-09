import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getTenantId } from '../config/tenant';

/**
 * useTenant Hook: Centralized identity and synchronization.
 * Ensures the tenant_id is always a valid UUID and stays in sync with the session.
 */
export const useTenant = () => {
  const [tenant, setTenant] = useState(null);
  const [userRole, setUserRole] = useState(null);
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
      let { data: userData, error: userError } = await supabase
        .from('Usuarios')
        .select('tenant_id, rol')
        .eq('email', user.email)
        .maybeSingle();

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let cleanTid = '00000000-0000-0000-0000-000000000000';

      if (userData?.tenant_id && uuidRegex.test(userData.tenant_id)) {
        cleanTid = userData.tenant_id;
      } else {
        // RESET MODE: If no user record found, force zero UUID to trigger onboarding
        console.warn('User identity not found in Usuarios. Triggering clean onboarding.');
        cleanTid = '00000000-0000-0000-0000-000000000000';
        localStorage.removeItem('onboarding_complete');
        localStorage.removeItem('saas_tenant_config');
      }

      console.log('🚀 [Identity] Resolved Final Tenant ID:', cleanTid);

      // 3. Fetch full metadata
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', cleanTid)
        .single();

      // If the tenant row doesn't exist in DB (was deleted), force zero UUID to re-trigger onboarding
      if (!tenantData && cleanTid !== '00000000-0000-0000-0000-000000000000') {
        console.warn('Tenant record not found in DB — forcing onboarding.');
        cleanTid = '00000000-0000-0000-0000-000000000000';
        localStorage.removeItem('onboarding_complete');
      }

      const finalTenant = {
        id: cleanTid,
        name: tenantData?.name || 'Empresa',
        logoUrl: tenantData?.logo_url,
        plan: tenantData?.plan || 'starter',
        ...(tenantData || {})
      };

      setTenant(finalTenant);
      setUserRole(userData?.rol || 'admin');
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

  return { tenant, userRole, loading, error, refresh: sync };
};
