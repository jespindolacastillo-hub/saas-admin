import { supabase } from '../lib/supabase';
import { tenantConfig } from '../config/tenant';

export const KpiService = {
    /**
     * Obtiene las metas del mes y año actuales para todas las tiendas.
     */
    async getMonthlyGoals(month, year) {
        try {
            const { data, error } = await supabase
                .from('Metas_KPI')
                .select('*')
                .eq('mes', month)
                .eq('anio', year)
                .eq('tenant_id', tenantConfig.id);

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Error fetching monthly goals:', err);
            return [];
        }
    },

    /**
     * Establece o actualiza una meta para una tienda específica.
     */
    async setGoal(storeId, month, year, targetNps, targetVolume) {
        try {
            const { data, error } = await supabase
                .from('Metas_KPI')
                .upsert({
                    tienda_id: storeId,
                    mes: month,
                    anio: year,
                    target_nps: targetNps,
                    target_volumen: targetVolume,
                    tenant_id: tenantConfig.id,
                    updated_at: new Date()
                }, { onConflict: 'tienda_id,mes,anio' })
                .select();

            if (error) throw error;
            return data[0];
        } catch (err) {
            console.error('Error setting goal:', err);
            throw err;
        }
    },

    /**
     * Calcula el progreso actual basado en datos reales vs metas.
     */
    calculateProgress(actualNps, targetNps, actualVol, targetVol) {
        return {
            npsProgress: targetNps > 0 ? Math.min(100, Math.max(0, (actualNps / targetNps) * 100)) : 0,
            volProgress: targetVol > 0 ? Math.min(100, Math.max(0, (actualVol / targetVol) * 100)) : 0,
            npsStatus: actualNps >= targetNps ? 'success' : actualNps >= (targetNps * 0.8) ? 'warning' : 'danger',
            volStatus: actualVol >= targetVol ? 'success' : actualVol >= (targetVol * 0.8) ? 'warning' : 'danger'
        };
    }
};
