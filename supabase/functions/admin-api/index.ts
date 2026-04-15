import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-customer-id, x-tenant-id',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    // SMTP Config (Same as campaign-email, likely Resend)
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465");

    try {
        const supabase = createClient(supabaseUrl, serviceKey);
        const { action, email, nombre, apellido, id, tenant_id, rol, flow, redirectTo } = await req.json();

        // 1. Helper: Database Synchronization for App User
        const syncWithDB = async (userData: any) => {
            const { error: dbError } = await supabase.from('Usuarios').upsert({
                id: userData.id,
                email: userData.email,
                nombre: nombre || 'Usuario',
                apellido: apellido || '',
                rol: rol || 'Usuario',
                tenant_id,
                activo: true,
                updated_at: new Date().toISOString()
            }, { onConflict: 'email' });
            if (dbError) throw dbError;
        };

        // 2. Helper: Ensure Distributor Record (Fix "Acceso Denegado")
        const ensureDistributor = async (userEmail: string, userName: string) => {
            console.log(`🔍 [Admin API] Checking distributor record for ${userEmail}...`);
            const { data: existing } = await supabase.from('distributors').select('id').eq('email', userEmail).maybeSingle();
            
            if (!existing) {
                const code = userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + Math.floor(Math.random() * 100);
                console.log(`✨ [Admin API] Creating new distributor record with code: ${code}`);
                const { error: distErr } = await supabase.from('distributors').insert({
                    email: userEmail,
                    name: userName,
                    code: code,
                    active: true,
                    portal_enabled: true,
                    tier: 'bronze',
                    commission_pct: 10,
                    tenant_id: tenant_id
                });
                if (distErr) throw distErr;
            } else {
                console.log(`ℹ️ [Admin API] Distributor exists. Ensuring portal access...`);
                await supabase.from('distributors').update({ portal_enabled: true, active: true }).eq('email', userEmail);
            }
        };

        // --- ACTIONS ---

        if (action === 'delete') {
            const { error: delErr } = await supabase.auth.admin.deleteUser(id);
            if (delErr && delErr.status !== 404) throw delErr;
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'sync') {
            if (!email) throw new Error('Email required');

            // Find or Invite
            const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
            if (listErr) throw listErr;
            
            const existing = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
            let targetUser = existing;

            if (!existing) {
                console.log(`✉️ [Admin API] Generating Invitation link for ${email}...`);
                // Generate the link instead of sending auto-email
                const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
                    type: 'invite',
                    email,
                    options: { 
                        data: { nombre, apellido },
                        redirectTo: redirectTo || 'https://retelio.app'
                    }
                });

                if (inviteError) throw inviteError;
                targetUser = inviteData.user;
                const invitationLink = inviteData.properties.action_link;

                // Provision Distributor if needed
                if (flow === 'distributor') {
                    await ensureDistributor(email, nombre);
                }

                // Send Custom Email via SMTP
                if (smtpHost && smtpUser && smtpPass) {
                    const isDist = flow === 'distributor';
                    const subject = isDist ? "Invitación: Portal de Socios Retelio" : "Bienvenido a Retelio - Activa tu cuenta";
                    
                    const html = `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border: 1px solid #eef0f2; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                            <div style="background: #0D0D12; padding: 32px; text-align: center;">
                                <img src="https://admin.retelio.app/retelio-final-logo-light.svg" alt="Retelio" style="height: 32px;">
                            </div>
                            <div style="padding: 40px 32px;">
                                <h1 style="font-size: 24px; color: #0D0D12; margin-bottom: 16px; font-weight: 800;">¡Hola, ${nombre}!</h1>
                                <p style="font-size: 16px; color: #4B5563; line-height: 1.6; margin-bottom: 24px;">
                                    ${isDist 
                                        ? `Has sido invitado a unirte al **Programa de Socios de Retelio**. Desde tu portal podrás gestionar tus referidos, ver tus comisiones en tiempo real y descargar tu kit de ventas.`
                                        : `Te damos la bienvenida a **Retelio**. Tu cuenta ha sido creada y está lista para que comiences a gestionar la reputación de tu negocio.`}
                                </p>
                                <div style="text-align: center; margin: 40px 0;">
                                    <a href="${invitationLink}" style="background: #FF5C3A; color: #fff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 16px; display: inline-block; box-shadow: 0 8px 16px rgba(255, 92, 58, 0.25);">
                                        ${isDist ? 'Activar mi Portal de Socio' : 'Activar mi Cuenta'}
                                    </a>
                                </div>
                                <p style="font-size: 14px; color: #9CA3AF; text-align: center;">
                                    Si el botón no funciona, copia y pega este enlace:<br>
                                    <span style="word-break: break-all; color: #FF5C3A;">${invitationLink}</span>
                                </p>
                            </div>
                            <div style="background: #F9FAFB; padding: 24px; text-align: center; border-top: 1px solid #eef0f2;">
                                <p style="font-size: 12px; color: #9CA3AF; margin: 0;">© 2026 Retelio · Inteligencia que escucha.</p>
                            </div>
                        </div>
                    `;

                    const client = new SMTPClient({
                        connection: {
                            hostname: smtpHost,
                            port: smtpPort,
                            tls: true,
                            auth: { username: smtpUser, password: smtpPass },
                        },
                    });

                    await client.send({
                        from: `Retelio <${smtpUser}>`,
                        to: email,
                        subject: subject,
                        html: html,
                    });
                    await client.close();
                }

                await syncWithDB(targetUser);
                return new Response(JSON.stringify({ success: true, mode: 'invited' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            } else {
                // Update existing
                const { data: updated, error: updErr } = await supabase.auth.admin.updateUserById(targetUser.id, {
                    user_metadata: { nombre, apellido }
                });
                if (updErr) throw updErr;
                
                if (flow === 'distributor') {
                    await ensureDistributor(email, nombre);
                }

                await syncWithDB(updated.user);
                return new Response(JSON.stringify({ success: true, mode: 'updated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }

        throw new Error('Action not supported');

    } catch (error: any) {
        console.error(`❌ Admin API Error:`, error.message);
        return new Response(JSON.stringify({ error: error.message, success: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }
});
