import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-customer-id, x-tenant-id',
}

Deno.serve(async (req) => {
    // Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    // Capture logs immediately for debugging in Supabase dashboard
    console.log(`📡 [Admin API] Incoming ${req.method} request`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';

    // If config is missing, return a clear 200 error instead of crashing
    if (!supabaseUrl || !serviceKey) {
        console.error('❌ [Admin API] Critical error: SUPABASE_URL or SERVICE_ROLE_KEY is missing from environment variables.');
        return new Response(
            JSON.stringify({ error: 'Server is not configured. Please set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL in project secrets.', success: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }

    try {
        const supabase = createClient(supabaseUrl, serviceKey);
        
        // 1. Read and parse body safely
        const bodyText = await req.text();
        if (!bodyText) throw new Error('Request body is empty');
        
        let payload;
        try {
            payload = JSON.parse(bodyText);
        } catch (e) {
            throw new Error(`Malformed JSON: ${bodyText.substring(0, 100)}...`);
        }

        const { action, email, password, nombre, apellido, id, tenant_id, rol } = payload;
        console.log(`🚀 [Admin API] Action: ${action || 'sync'} | Email: ${email} | Tenant: ${tenant_id}`);

        // Helper: Database Synchronization
        const syncWithDB = async (user: any) => {
            if (!tenant_id || tenant_id === '00000000-0000-0000-0000-000000000000') {
                console.warn('⚠️ [Admin API] No valid tenant_id provided. Skipping Usuarios table sync.');
                return;
            }

            console.log(`💾 [Admin API] Syncing Usuarios table for ${user.email}...`);
            const { error: dbError } = await supabase.from('Usuarios').upsert({
                id: user.id,
                email: user.email,
                nombre: nombre || user.user_metadata?.nombre || 'Admin',
                apellido: apellido || user.user_metadata?.apellido || '',
                rol: rol || 'Usuario',
                tenant_id,
                activo: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'email' });

            if (dbError) {
                console.error(`❌ [Admin API] DB Upsert Error:`, dbError);
                throw new Error(`Database error: ${dbError.message} (${dbError.code || ''})`);
            }
            console.log(`✅ [Admin API] DB sync complete.`);
        };

        // --- HANDLER: PING ---
        if (action === 'ping') {
            return new Response(JSON.stringify({ success: true, message: 'pong', timestamp: new Date().toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // --- HANDLER: DELETE ---
        if (action === 'delete') {
            const userId = id || (await (async () => {
                const { data: { users } } = await supabase.auth.admin.listUsers();
                return users.find(u => u.email?.toLowerCase() === email?.toLowerCase())?.id;
            })());

            if (!userId) throw new Error('User not found to delete.');
            
            console.log(`🗑️ [Admin API] Deleting user ${userId} from Auth...`);
            const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
            if (delErr && delErr.status !== 404) throw delErr;

            return new Response(JSON.stringify({ success: true, message: 'User deleted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // --- HANDLER: SYNC (Create/Update) ---
        if (!email) throw new Error('Email is required for sync');

        console.log(`🔍 [Admin API] Checking user existence for ${email}...`);
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            user_metadata: { nombre, apellido },
            email_confirm: true
        });

        if (createError) {
            // Case: User already exists
            if (createError.status === 422 || createError.message.includes('already registered')) {
                console.log(`ℹ️ [Admin API] User exists. Updating metadata...`);
                const { data: { users } } = await supabase.auth.admin.listUsers();
                const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

                if (!existing) throw new Error('User already in Auth but could not be retrieved.');

                const updateData: any = { user_metadata: { nombre, apellido }, email_confirm: true };
                if (password && password.length >= 6) updateData.password = password;

                const { data: updated, error: updErr } = await supabase.auth.admin.updateUserById(existing.id, updateData);
                if (updErr) throw updErr;

                await syncWithDB(updated.user);
                return new Response(JSON.stringify({ user: updated.user, success: true, mode: 'updated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            }
            throw createError;
        }

        // Case: New user created
        await syncWithDB(newUser.user);
        console.log(`🎉 [Admin API] Successfully created and synced ${email}`);
        return new Response(JSON.stringify({ user: newUser.user, success: true, mode: 'created' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

    } catch (error: any) {
        const errorMessage = error?.message || 'Unknown server error';
        console.error(`❌ [Admin API] Error in request:`, errorMessage);
        
        return new Response(
            JSON.stringify({ 
                error: errorMessage, 
                success: false,
                stack: error?.stack?.substring(0, 100)
            }), 
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }
});
