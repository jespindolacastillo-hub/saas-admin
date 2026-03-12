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
        const { action, email, password, nombre, apellido, id } = JSON.parse(text);

        console.log(`🚀 [Admin API] Action: ${action || 'sync'} for ${email || id}`);

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

        const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
            email,
            password,
            user_metadata: { nombre, apellido },
            email_confirm: true
        })

        if (createError) {
            if (createError.message.includes('already registered') || createError.status === 422) {
                const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers()
                if (listError) throw listError;

                let existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

                if (!existingUser) {
                    const { data: dbUser } = await supabaseClient.from('Usuarios').select('id').eq('email', email).maybeSingle();
                    if (!dbUser) throw new Error('User already registered in Auth but could not be located.');
                    existingUser = { id: dbUser.id };
                }

                const updateData: any = { user_metadata: { nombre, apellido }, email_confirm: true };
                if (password && password.length >= 6) updateData.password = password;

                const { data: updatedUser, error: updateError } = await supabaseClient.auth.admin.updateUserById(existingUser.id, updateData);
                if (updateError) throw updateError;

                return new Response(JSON.stringify({ user: updatedUser.user, success: true, message: 'Updated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
            } else {
                throw createError;
            }
        }

        return new Response(JSON.stringify({ user: newUser.user, success: true, message: 'Created' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

    } catch (error) {
        console.error(`❌ [Admin API] Error: ${error.message}`);
        return new Response(JSON.stringify({ error: error.message, success: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }
})
