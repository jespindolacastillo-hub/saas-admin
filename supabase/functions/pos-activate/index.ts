import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const {
      pos,
      pos_store_id,
      store_name,
      owner_name,
      phone,
      email,
      password,
      google_review_url,
      discount_pct,
      discount_description,
    } = await req.json();

    if (!pos || !store_name || !email || !password || !phone) {
      return json({ error: "Faltan campos requeridos: pos, store_name, email, password, phone" }, 400);
    }

    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const feedbackBase = Deno.env.get("FEEDBACK_BASE_URL") ?? "https://admin.retelio.app/f";
    const affiliateId  = Deno.env.get("MITEINDITA_AFFILIATE_ID");

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Create auth user
    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authErr) return json({ error: authErr.message }, 400);
    const userId = authData.user!.id;

    // 2. Create tenant
    const { data: tenant, error: tenantErr } = await sb
      .from("tenants")
      .insert({
        name:                     store_name,
        plan:                     "pos-embed",
        plan_status:              "active",
        pos_name:                 pos,
        pos_store_id:             pos_store_id ?? null,
        google_review_url:        google_review_url ?? null,
        google_review_enabled:    !!google_review_url,
        google_review_min_rating: 4,
        affiliate_id:             affiliateId ?? null,
        ref_code_used:            pos.toUpperCase(),
        mrr:                      0,
      })
      .select("id, embed_token")
      .single();
    if (tenantErr) {
      await sb.auth.admin.deleteUser(userId);
      return json({ error: tenantErr.message }, 500);
    }

    // 3. Create Usuarios row (upsert on email to handle re-activation)
    const { error: userErr } = await sb.from("Usuarios").upsert({
      id:        userId,
      email,
      nombre:    owner_name ?? store_name,
      apellido:  "",
      rol:       "admin",
      tenant_id: tenant.id,
      activo:    true,
    }, { onConflict: "email" });
    if (userErr) {
      await sb.auth.admin.deleteUser(userId);
      await sb.from("tenants").delete().eq("id", tenant.id);
      return json({ error: userErr.message }, 500);
    }

    // 4. Create location in the new feedback system
    const { data: location, error: locationErr } = await sb
      .from("locations")
      .insert({
        tenant_id:                tenant.id,
        name:                     store_name,
        google_review_url:        google_review_url ?? null,
        google_review_enabled:    !!google_review_url,
        google_review_min_rating: 4,
        whatsapp_number:          phone,
      })
      .select("id")
      .single();
    if (locationErr) return json({ error: locationErr.message }, 500);

    // 5. Create coupon config if discount provided
    let couponConfigId: string | null = null;
    if (discount_pct) {
      const { data: cc } = await sb
        .from("coupon_configs")
        .insert({
          tenant_id:         tenant.id,
          name:              "Cupón de recuperación POS",
          offer_description: discount_description ?? `${discount_pct}% de descuento en tu próxima visita`,
          offer_value:       discount_pct,
          validity_days:     30,
          active:            true,
        })
        .select("id")
        .single();
      couponConfigId = cc?.id ?? null;
    }

    // 6. Create QR code — its id becomes the clean feedback URL key
    const { data: qrCode, error: qrErr } = await sb
      .from("qr_codes")
      .insert({
        tenant_id:        tenant.id,
        location_id:      location.id,
        type:             "ticket",
        label:            store_name,
        coupon_config_id: couponConfigId,
        active:           true,
      })
      .select("id")
      .single();
    if (qrErr) return json({ error: qrErr.message }, 500);

    // 7. Create POS store record — keeps api_key, links to location + qr_code
    const { data: store, error: storeErr } = await sb
      .from("Tiendas_Catalogo")
      .insert({
        nombre:        store_name,
        tenant_id:     tenant.id,
        owner_user_id: userId,
        pos_enabled:   true,
        location_id:   location.id,
        qr_code_id:    qrCode.id,
      })
      .select("id, api_key")
      .single();
    if (storeErr) return json({ error: storeErr.message }, 500);

    const feedbackUrl = `${feedbackBase}/${qrCode.id}`;

    return json({
      tenant_id:    tenant.id,
      store_id:     store.id,
      embed_token:  tenant.embed_token,
      api_key:      store.api_key,
      feedback_url: feedbackUrl,
      qr_api_url:   `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(feedbackUrl)}`,
    });
  } catch (err) {
    console.error("pos-activate error:", err);
    return json({ error: "Error interno del servidor" }, 500);
  }
});
