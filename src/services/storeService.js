import { tenantConfig } from '../config/tenant';
import { PLAN_LIMITS } from '../config/planLimits';

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
            .eq('tenant_id', tenantConfig.id)
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
                .eq('tenant_id', tenantConfig.id);
            
            const limit = PLAN_LIMITS[tenantConfig.plan]?.maxStores || 0;
            if (count >= limit) {
                throw new Error(`Tu plan (${PLAN_LIMITS[tenantConfig.plan]?.name}) permite máximo ${limit} sucursales. Sube de plan para añadir más.`);
            }
        }

        const id = isNew
            ? storeData.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
            : storeData.id;

        const payload = { ...storeData, tenant_id: tenantConfig.id };
        delete payload.id;
        if (isNew) payload.id = id;

        // 1. Guardar la tienda
        const { error: storeError } = await supabase
            .from('Tiendas_Catalogo')
            .upsert([payload]);

        if (storeError) throw storeError;

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

        return { id, ...storeData };
    },

    /**
     * Elimina una tienda y limpia sus relaciones.
     */
    async deleteStore(id) {
        // Limpiamos relaciones primero (cascada manual)
        await supabase.from('Tienda_Areas').delete().eq('tienda_id', id);

        const { error } = await supabase
            .from('Tiendas_Catalogo')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenantConfig.id);

        if (error) throw error;
    }
};
