import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Manejar CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''

    if (!serviceKey) {
        console.error('❌ SERVICE_ROLE_KEY no configurada')
        return new Response(
            JSON.stringify({ error: 'Error de configuración: SERVICE_ROLE_KEY no encontrada en el servidor.', success: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    }

    try {
        const supabaseClient = createClient(supabaseUrl, serviceKey)

        const { email, password, nombre, apellido } = await req.json()

        if (!email || !password) {
            throw new Error('Email y password son requeridos')
        }

        console.log(`🚀 Intentando sincronizar usuario: ${email}`)

        // Intentar crear usuario en Auth
        let user;
        const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
            email: email,
            password: password,
            user_metadata: { nombre, apellido },
            email_confirm: true
        })

        if (createError) {
            console.log(`⚠️ Error al crear (puede que ya exista): ${createError.message}`)
            // Si el usuario ya existe, intentamos actualizar su contraseña
            if (createError.message.includes('already registered')) {
                console.log(`🔍 Buscando usuario existente: ${email}`)
                const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers({
                    perPage: 1000
                })
                if (listError) {
                    console.error(`❌ Error al listar usuarios: ${listError.message}`)
                    throw listError
                }

                const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase())
                if (!existingUser) {
                    console.error(`❌ Usuario no encontrado en la lista de Auth: ${email}`)
                    throw new Error('El usuario ya está registrado en Auth pero no pudimos localizar su ID para actualizarlo.')
                }

                console.log(`✅ Usuario encontrado (ID: ${existingUser.id}). Actualizando contraseña...`)
                const { data: updatedUser, error: updateError } = await supabaseClient.auth.admin.updateUserById(
                    existingUser.id,
                    {
                        password: password,
                        user_metadata: { nombre, apellido },
                        email_confirm: true
                    }
                )
                if (updateError) {
                    console.error(`❌ Error al actualizar usuario: ${updateError.message}`)
                    throw updateError
                }
                user = updatedUser.user
                console.log(`🚀 Usuario actualizado exitosamente en Auth`)
            } else {
                console.error(`❌ Error crítico: ${createError.message}`)
                throw createError
            }
        } else {
            user = newUser.user
            console.log(`🚀 Nuevo usuario creado exitosamente en Auth (ID: ${user.id})`)
        }

        return new Response(
            JSON.stringify({ user, success: true }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error) {
        console.error(`❌ Error atrapado: ${error.message}`)
        return new Response(
            JSON.stringify({ error: error.message, success: false }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )
    }
})
