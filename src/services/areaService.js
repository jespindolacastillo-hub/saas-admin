import { tenantConfig } from '../config/tenant';
import { PLAN_LIMITS } from '../config/planLimits';

/**
 * AreaService: Gestión del catálogo de áreas.
 */
export const AreaService = {
    /**
     * Obtiene la lista completa de áreas.
     */
    async listAreas() {
        const { data, error } = await supabase
            .from('Areas_Catalogo')
            .select('*')
            .eq('tenant_id', tenantConfig.id)
            .order('orden');

        if (error) throw error;
        return data;
    },

    /**
     * Guarda una área (create/upsert).
     */
    async saveArea(areaData) {
        const isNew = !areaData.id;

        if (isNew) {
            const { count } = await supabase
                .from('Areas_Catalogo')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenantConfig.id);
            
            const limit = PLAN_LIMITS[tenantConfig.plan]?.maxAreas || 0;
            if (count >= limit) {
                throw new Error(`Tu plan (${PLAN_LIMITS[tenantConfig.plan]?.name}) permite máximo ${limit} áreas por catálogo. Sube de plan para añadir más.`);
            }
        }

        // Si es nueva, generamos un slug como ID si no existe
        const id = isNew
            ? areaData.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
            : areaData.id;

        const payload = { ...areaData, tenant_id: tenantConfig.id };
        delete payload.id;
        if (isNew) payload.id = id;

        const { error } = await supabase
            .from('Areas_Catalogo')
            .upsert([payload]);

        if (error) throw error;
        return { id, ...areaData };
    },

    /**
     * Elimina una área y limpia sus relaciones.
     */
    async deleteArea(id) {
        // Limpiamos relaciones primero (cascada manual)
        await supabase.from('Tienda_Areas').delete().eq('area_id', id);

        const { error } = await supabase
            .from('Areas_Catalogo')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenantConfig.id);

        if (error) throw error;
    }
};
