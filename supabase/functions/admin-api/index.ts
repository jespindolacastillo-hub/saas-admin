import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-customer-id, x-tenant-id',
}

serve(async (req) => {
    // Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    // Capture logs immediately
    console.log(`📡 [Admin API] Incoming ${req.method} request`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !serviceKey) {
        return new Response(
            JSON.stringify({ error: 'Server configuration error: Missing Secrets (SUPABASE_SERVICE_ROLE_KEY).', success: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }

    try {
        const supabase = createClient(supabaseUrl, serviceKey);
        
        const bodyText = await req.text();
        if (!bodyText) throw new Error('Request body is empty');
        
        let payload;
        try {
            payload = JSON.parse(bodyText);
        } catch (e) {
            throw new Error(`Malformed JSON in body`);
        }

        const { action, email, password, nombre, apellido, id, tenant_id, rol } = payload;

        // Helper: Database Synchronization
        const syncWithDB = async (userData: any) => {
            if (!tenant_id || tenant_id === '00000000-0000-0000-0000-000000000000') {
                console.warn('⚠️ No valid tenant_id provided.');
                return;
            }

            const { error: dbError } = await supabase.from('Usuarios').upsert({
                id: userData.id,
                email: userData.email,
                nombre: nombre || 'Admin',
                apellido: apellido || '',
                rol: rol || 'Usuario',
                tenant_id,
                activo: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'email' });

            if (dbError) throw new Error(`Database error: ${dbError.message}`);
        };

        if (action === 'ping') {
            return new Response(JSON.stringify({ success: true, message: 'pong' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        if (action === 'delete') {
            const { error: delErr } = await supabase.auth.admin.deleteUser(id);
            if (delErr && delErr.status !== 404) throw delErr;
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // --- HANDLER: SYNC (Create/Invite/Update) ---
        if (!email) throw new Error('Email is required');

        console.log(`🔍 [Admin API] Checking user existence for ${email}...`);
        
        // Try to find the user first to decide between Invite and Update
        const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
        if (listErr) throw listErr;
        
        const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (!existing) {
            console.log(`✉️ [Admin API] User not found. Sending Invitation to ${email}...`);
            const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
                data: { nombre, apellido },
                // Redirect to the admin site if configured
                redirectTo: req.headers.get('origin') || undefined
            });

            if (inviteError) throw inviteError;

            // Sync with DB immediately so the UI shows the user (pending)
            await syncWithDB(inviteData.user);
            return new Response(JSON.stringify({ user: inviteData.user, success: true, mode: 'invited' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        } else {
            // User exists: Update metadata
            console.log(`ℹ️ [Admin API] User exists. Updating metadata for ${existing.id}...`);
            const updateData: any = { user_metadata: { nombre, apellido } };
            // If admin provided a password, update it too
            if (password && password.length >= 6) updateData.password = password;

            const { data: updated, error: updErr } = await supabase.auth.admin.updateUserById(existing.id, updateData);
            if (updErr) throw updErr;

            await syncWithDB(updated.user);
            return new Response(JSON.stringify({ user: updated.user, success: true, mode: 'updated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

    } catch (error: any) {
        console.error(`❌ Error logic:`, error.message);
        return new Response(
            JSON.stringify({ error: error.message, success: false }), 
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }
});
