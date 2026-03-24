import { tenantConfig, getTenantId } from '../config/tenant';
import { PLAN_LIMITS } from '../config/planLimits';
import { supabase } from '../lib/supabase';
import { refreshMRR } from './mrrService';

/**
 * StoreService: Gestión de tiendas y su relación con las áreas.
 */
export const StoreService = {
    /**
     * Obtiene la lista de tiendas con sus encargados.
     */
    async listStores() {
        const { data, error } = await supabase
            .from('Tiendas_Catalogo')
            .select('*, Usuarios(nombre, apellido)')
            .eq('tenant_id', getTenantId())
            .order('nombre');

        if (error) throw error;
        return data;
    },

    /**
     * Obtiene todas las relaciones tienda-área.
     */
    async listTiendaAreas() {
        const { data, error } = await supabase
            .from('Tienda_Areas')
            .select('*, Tiendas_Catalogo(nombre), Areas_Catalogo(nombre, color)')
            .eq('Tiendas_Catalogo.tenant_id', tenantConfig.id); // Note: This might need RLS instead or a direct filter if tenant_id is in join table

        if (error) throw error;
        return data;
    },

    /**
     * Guarda una tienda (create/upsert) y gestiona sus áreas vinculadas.
     */
    async saveStore(storeData, selectedAreasSet) {
        const isNew = !storeData.id;

        if (isNew) {
            const { count } = await supabase
                .from('Tiendas_Catalogo')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', getTenantId());
            
            const limit = PLAN_LIMITS[tenantConfig.plan]?.maxStores || 0;
            if (count >= limit) {
                throw new Error(`Tu plan (${PLAN_LIMITS[tenantConfig.plan]?.name}) permite máximo ${limit} sucursales. Sube de plan para añadir más.`);
            }
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const payload = { ...storeData, tenant_id: getTenantId() };
        
        // PROTECCIÓN: Si el ID no es un UUID válido (ej: legacy slug), lo eliminamos del payload para que Supabase genere uno nuevo.
        if (payload.id && !uuidRegex.test(payload.id)) {
            delete payload.id;
        }

        // 1. Guardar la tienda
        const { data: savedStore, error: storeError } = await supabase
            .from('Tiendas_Catalogo')
            .upsert([payload])
            .select('id')
            .single();

        if (storeError) throw storeError;
        const id = savedStore.id;

        // 2. Sincronizar Áreas vinculadas
        // Primero eliminamos las anteriores para esta tienda
        await supabase.from('Tienda_Areas').delete().eq('tienda_id', id);

        // Insertamos las nuevas
        const links = Array.from(selectedAreasSet).map(areaId => ({
            tienda_id: id,
            area_id: areaId,
            activa: true
        }));

        if (links.length > 0) {
            const { error: linkError } = await supabase.from('Tienda_Areas').insert(links);
            if (linkError) throw linkError;
        }

        refreshMRR(getTenantId()); // fire-and-forget
        return { id, ...storeData };
    },

    /**
     * Elimina una tienda y limpia sus relaciones.
     */
    async deleteStore(id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            throw new Error("ID de tienda inválido (formato esperado: UUID).");
        }
        
        // Limpiamos relaciones primero (cascada manual)
        await supabase.from('Tienda_Areas').delete().eq('tienda_id', id);

        const { error } = await supabase
            .from('Tiendas_Catalogo')
            .delete()
            .eq('id', id)
            .eq('tenant_id', getTenantId());

        if (error) throw error;
        refreshMRR(getTenantId()); // fire-and-forget
    }
};
