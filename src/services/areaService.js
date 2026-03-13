import { tenantConfig, getTenantId } from '../config/tenant';
import { PLAN_LIMITS } from '../config/planLimits';
import { supabase } from '../lib/supabase';

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
            .eq('tenant_id', getTenantId())
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
                .eq('tenant_id', getTenantId());
            
            const limit = PLAN_LIMITS[tenantConfig.plan]?.maxAreas || 0;
            if (count >= limit) {
                throw new Error(`Tu plan (${PLAN_LIMITS[tenantConfig.plan]?.name}) permite máximo ${limit} áreas por catálogo. Sube de plan para añadir más.`);
            }
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const payload = { ...areaData, tenant_id: getTenantId() };
        
        // PROTECCIÓN: Si el ID no es un UUID válido (ej: legacy slug), lo eliminamos del payload
        if (payload.id && !uuidRegex.test(payload.id)) {
            delete payload.id;
        }

        const { data: savedArea, error } = await supabase
            .from('Areas_Catalogo')
            .upsert([payload])
            .select('id')
            .single();

        if (error) throw error;
        const id = savedArea.id;
        return { id, ...areaData };
    },

    /**
     * Añade una nueva área directamente vinculada a una tienda.
     */
    async addArea(storeId, areaName) {
        const tid = getTenantId();
        const { data, error } = await supabase
            .from('Areas_Catalogo')
            .insert([{ 
                nombre: areaName, 
                tenant_id: tid,
                tienda_id: storeId // Direct Link
            }])
            .select().single();
        if (error) throw error;
        return data;
    },

    /**
     * Elimina una área y limpia sus relaciones.
     */
    async deleteArea(id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            throw new Error("ID de área inválido (formato esperado: UUID).");
        }

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
