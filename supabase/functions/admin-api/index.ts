import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''

    if (!serviceKey || !supabaseUrl) {
        console.error('❌ Configuration missing');
        return new Response(
            JSON.stringify({ error: 'Server configuration error.', success: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    }

    try {
        const supabaseClient = createClient(supabaseUrl, serviceKey)
        const text = await req.text();
        const { action, email, password, nombre, apellido, id, tenant_id, rol } = JSON.parse(text);

        console.log(`🚀 [Admin API] Action: ${action || 'sync'} for ${email || id} | Tenant: ${tenant_id}`);

        // Helper to sync with DB
        const syncWithDB = async (user: any) => {
            if (!tenant_id) {
                console.warn('⚠️ [Admin API] No tenant_id provided for sync. Skipping DB upsert.');
                return;
            }
            console.log(`🚀 [Admin API] Attempting DB upsert for ${user.email} (Tenant: ${tenant_id})`);
            const { error: dbErr } = await supabaseClient.from('Usuarios').upsert({
                id: user.id,
                email: user.email,
                nombre,
                apellido,
                rol: rol || 'Usuario',
                tenant_id,
                updated_at: new Date().toISOString(),
                activo: true
            }, { onConflict: 'email' });
            
            if (dbErr) {
                console.error(`❌ [Admin API] DB Sync Error details:`, dbErr);
                throw new Error(`Error en base de datos: ${dbErr.message} ${dbErr.details || ''} ${dbErr.hint || ''}`);
            }
            console.log(`✅ [Admin API] DB sync successful for ${user.email}`);
        };

        // --- ACTION: DELETE ---
        if (action === 'delete') {
            let targetId = id;

            // If ID is missing, try to find it by email
            if (!targetId && email) {
                const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers();
                if (!listError) {
                    const found = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
                    if (found) targetId = found.id;
                }
            }

            if (!targetId) throw new Error('User ID or corresponding Email required for deletion.');

            console.log(`🗑️ [Admin API] Deleting user from Auth: ${targetId}`);
            const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(targetId);

            if (deleteError) {
                console.warn(`⚠️ [Admin API] Auth delete error: ${deleteError.message}`);
                // We return success if it's already gone (404) or specific errors
                if (deleteError.status === 404) {
                    return new Response(JSON.stringify({ success: true, message: 'User not found in Auth, nothing to delete.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
                }
                throw deleteError;
            }

            return new Response(JSON.stringify({ success: true, message: 'User deleted from Auth.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // --- ACTION: SYNC (CREATE/UPDATE) ---
        if (!email) throw new Error('Email is required for sync');

        console.log(`🔍 [Admin API] Checking/Creating Auth user for ${email}...`);
        const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
            email,
            password,
            user_metadata: { nombre, apellido },
            email_confirm: true
        })

        if (createError) {
            console.log(`ℹ️ [Admin API] Create error (checking if exists): ${createError.message}`);
            if (createError.message.includes('already registered') || createError.status === 422) {
                console.log(`🔍 [Admin API] Searching for existing user ${email}...`);
                const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers()
                if (listError) throw listError;

                let existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

                if (!existingUser) {
                    console.log(`🔍 [Admin API] Not in listUsers, checking Usuarios table...`);
                    const { data: dbUser } = await supabaseClient.from('Usuarios').select('id').eq('email', email).maybeSingle();
                    if (!dbUser) throw new Error('User already registered in Auth but could not be located.');
                    existingUser = { id: dbUser.id };
                }

                console.log(`🚀 [Admin API] Updating Auth user ${existingUser.id}...`);
                const updateData: any = { user_metadata: { nombre, apellido }, email_confirm: true };
                if (password && password.length >= 6) updateData.password = password;

                const { data: updatedUser, error: updateError } = await supabaseClient.auth.admin.updateUserById(existingUser.id, updateData);
                if (updateError) throw updateError;

                // Sync with DB
                console.log(`🚀 [Admin API] Syncing DB for ${email}...`);
                await syncWithDB(updatedUser.user);

                return new Response(JSON.stringify({ user: updatedUser.user, success: true, message: 'Updated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            } else {
                throw createError;
            }
        }

        // Sync with DB
        console.log(`🚀 [Admin API] Syncing DB for new user ${email}...`);
        await syncWithDB(newUser.user);

        return new Response(JSON.stringify({ user: newUser.user, success: true, message: 'Created' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

    } catch (error) {
        console.error(`❌ [Admin API] Error: ${error.message}`);
        return new Response(JSON.stringify({ error: error.message, success: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }
})
