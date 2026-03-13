import { supabase } from '../lib/supabase';
import { tenantConfig, getTenantId } from '../config/tenant';

/**
 * UserService: Capa de servicios centralizada para la gestión de usuarios.
 * Maneja la comunicación con Supabase Auth, Base de Datos y Edge Functions.
 */
export const UserService = {
    /**
     * Obtiene la lista completa de usuarios combinando Auth y DB (si es necesario).
     * Por defecto lee de la tabla 'Usuarios' que debería estar sincronizada.
     */
    async listUsers() {
        const { data, error } = await supabase
            .from('Usuarios')
            .select('*')
            .eq('tenant_id', getTenantId())
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Sincroniza un usuario con Supabase Auth y la base de datos local.
     * Utiliza la Edge Function para operaciones administrativas seguras.
     */
    async saveUser(userData) {
        const { email, password, nombre, apellido, rol, activo, id } = userData;
        const isNew = !id;

        // Solo sincronizamos con Auth si es nuevo o si se proporcionó un password (mínimo 6 caracteres)
        const shouldUpdateAuth = isNew || (password && password.length >= 6);

        if (shouldUpdateAuth) {
            console.log(`🔄 Sincronizando ${email} con Supabase Auth...`);

            // Llamada a la Edge Function centralizada (admin-api)
            const { data, error: funcError } = await supabase.functions.invoke('admin-api', {
                body: {
                    action: 'sync',
                    email,
                    password,
                    nombre,
                    apellido
                }
            });

            if (funcError || (data && data.success === false)) {
                let errorMsg = funcError?.message || data?.error || 'Error desconocido';
                if (errorMsg.includes('401')) {
                    errorMsg = "No autorizado (401). Verifica las llaves API en Netlify/Supabase.";
                }
                throw new Error(errorMsg);
            }

            const resultUser = data.user;

            // El payload para la base de datos debe incluir el ID de Auth
            const payload = {
                id: resultUser.id,
                email,
                nombre,
                apellido,
                rol,
                activo: activo ?? true,
                tenant_id: tenantConfig.id,
                updated_at: new Date().toISOString()
            };

            const { error: dbError } = await supabase
                .from('Usuarios')
                .upsert(payload, { onConflict: 'email' });

            if (dbError) throw dbError;
            return resultUser;
        } else {
            // Si no hay cambio de password/auth, solo actualizamos metadatos en DB
            const { error: dbError } = await supabase
                .from('Usuarios')
                .update({ nombre, apellido, rol, activo, updated_at: new Date().toISOString() })
                .eq('id', id)
                .eq('tenant_id', getTenantId());

            if (dbError) throw dbError;
            return { id };
        }
    },

    /**
     * Cambia el estado de activación de un usuario.
     */
    async toggleStatus(id, active) {
        const { error } = await supabase
            .from('Usuarios')
            .update({ activo: active, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('tenant_id', getTenantId());

        if (error) throw error;
    },

    /**
     * Elimina un usuario de la base de datos y de Auth vía Edge Function.
     */
    async deleteUser(id, email) {
        console.log(`🗑️ Eliminando usuario: ${email} (ID: ${id})`);

        // 1. Eliminar de Auth vía Admin API
        const { data, error: funcError } = await supabase.functions.invoke('admin-api', {
            body: { action: 'delete', id, email }
        });

        if (funcError || (data && data.success === false)) {
            console.error('⚠️ Error al eliminar de Auth (posiblemente ya no existe):', funcError || data?.error);
            // Continuamos de todos modos para limpiar la DB local
        }

        // 2. Eliminar de la base de datos local
        const { error: dbError } = await supabase
            .from('Usuarios')
            .delete()
            .eq('id', id)
            .eq('tenant_id', getTenantId());

        if (dbError) throw dbError;
    }
};
