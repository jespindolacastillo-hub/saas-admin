import { supabase } from '../lib/supabase';
import { tenantConfig } from '../config/tenant';

export const ConfigService = {
    /**
     * Captura el estado actual de todos los catálogos y lo guarda como un snapshot.
     */
    async createSnapshot(nombre, descripcion = '', isAuto = false) {
        try {
            // 1. Obtener datos de todas las tablas de configuración
            const [tiendas, areas, tiendaAreas, preguntas] = await Promise.all([
                supabase.from('Tiendas_Catalogo').select('*').eq('tenant_id', tenantConfig.id),
                supabase.from('Areas_Catalogo').select('*').eq('tenant_id', tenantConfig.id),
                supabase.from('Tienda_Areas').select('*, Tiendas_Catalogo(tenant_id)').eq('Tiendas_Catalogo.tenant_id', tenantConfig.id),
                supabase.from('Area_Preguntas').select('*').eq('tenant_id', tenantConfig.id)
            ]);

            if (tiendas.error) throw tiendas.error;
            if (areas.error) throw areas.error;
            if (tiendaAreas.error) throw tiendaAreas.error;
            if (preguntas.error) throw preguntas.error;

            const snapshot_data = {
                tiendas: tiendas.data,
                areas: areas.data,
                tiendaAreas: tiendaAreas.data,
                preguntas: preguntas.data,
                version: "1.0",
                captured_at: new Date().toISOString()
            };

            const { data: userData } = await supabase.auth.getUser();

            // 2. Guardar el snapshot
            const { data, error } = await supabase
                .from('Config_Snapshots')
                .insert([{
                    nombre,
                    descripcion,
                    snapshot_data,
                    num_tiendas: tiendas.data.length,
                    num_areas: areas.data.length,
                    num_preguntas: preguntas.data.length,
                    is_auto: isAuto,
                    created_by: userData.user?.id,
                    tenant_id: tenantConfig.id
                }])
                .select();

            if (error) throw error;
            return data[0];
        } catch (err) {
            console.error('Error creating snapshot:', err);
            throw err;
        }
    },

    /**
     * Lista los snapshots disponibles descendentemente por fecha.
     */
    async listSnapshots() {
        const { data, error } = await supabase
            .from('Config_Snapshots')
            .select('*')
            .eq('tenant_id', tenantConfig.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Restaura la configuración a partir de un snapshot JSON.
     * ADVERTENCIA: Esto limpia las tablas actuales antes de re-insertar.
     */
    async restoreSnapshot(snapshotId) {
        try {
            // 1. Obtener el snapshot
            const { data: snapshot, error: fetchErr } = await supabase
                .from('Config_Snapshots')
                .select('*')
                .eq('id', snapshotId)
                .eq('tenant_id', tenantConfig.id)
                .single();

            if (fetchErr) throw fetchErr;
            const { snapshot_data } = snapshot;

            // 2. Transacción de restauración (Simulada mediante borrado y re-inserción secuencial)
            // IMPORTANTE: El orden importa por las llaves foráneas

            // A. Primero borrar relaciones y preguntas
            await supabase.from('Area_Preguntas').delete().eq('tenant_id', tenantConfig.id);
            await supabase.from('Tienda_Areas').delete().eq('Tiendas_Catalogo.tenant_id', tenantConfig.id); // This might needs a different way or RLS

            // B. Borrar catálogos base
            await supabase.from('Areas_Catalogo').delete().eq('tenant_id', tenantConfig.id);
            await supabase.from('Tiendas_Catalogo').delete().eq('tenant_id', tenantConfig.id);

            // C. Re-insertar catálogos base
            if (snapshot_data.tiendas.length > 0) {
                const { error: e1 } = await supabase.from('Tiendas_Catalogo').insert(snapshot_data.tiendas);
                if (e1) throw e1;
            }

            if (snapshot_data.areas.length > 0) {
                const { error: e2 } = await supabase.from('Areas_Catalogo').insert(snapshot_data.areas);
                if (e2) throw e2;
            }

            // D. Re-insertar relaciones y preguntas
            if (snapshot_data.tiendaAreas.length > 0) {
                const { error: e3 } = await supabase.from('Tienda_Areas').insert(snapshot_data.tiendaAreas);
                if (e3) throw e3;
            }

            if (snapshot_data.preguntas.length > 0) {
                const { error: e4 } = await supabase.from('Area_Preguntas').insert(snapshot_data.preguntas);
                if (e4) throw e4;
            }

            return true;
        } catch (err) {
            console.error('Error restoring snapshot:', err);
            throw err;
        }
    },

    async deleteSnapshot(id) {
        const { error } = await supabase
            .from('Config_Snapshots')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenantConfig.id);

        if (error) throw error;
        return true;
    }
};
