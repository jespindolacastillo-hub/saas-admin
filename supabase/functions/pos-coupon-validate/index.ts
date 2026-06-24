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
    const { api_key, coupon_code } = await req.json();

    if (!api_key || !coupon_code) {
      return json({ error: "Faltan campos: api_key, coupon_code" }, 400);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: store } = await sb
      .from("Tiendas_Catalogo")
      .select("id, tenant_id")
      .eq("api_key", api_key)
      .eq("pos_enabled", true)
      .single();

    if (!store) return json({ valid: false, reason: "api_key inválida" }, 401);

    const { data: fb } = await sb
      .from("feedbacks")
      .select("id, coupon_code, coupon_redeemed, coupon_redeemed_at, score, qr_id, applied_discount_pct")
      .eq("coupon_code", coupon_code.trim().toUpperCase())
      .eq("tenant_id", store.tenant_id)
      .maybeSingle();

    if (!fb) return json({ valid: false, reason: "Código no encontrado" });

    if (fb.coupon_redeemed) {
      return json({
        valid:       false,
        reason:      "already_redeemed",
        redeemed_at: fb.coupon_redeemed_at,
      });
    }

    // Resolve offer description via qr_codes → coupon_configs
    let offer: Record<string, unknown> = {
      offer_description: "Descuento especial",
      offer_value:       fb.applied_discount_pct ?? null,
    };
    if (fb.qr_id) {
      const { data: qr } = await sb
        .from("qr_codes")
        .select("coupon_config_id")
        .eq("id", fb.qr_id)
        .maybeSingle();
      if (qr?.coupon_config_id) {
        const { data: cfg } = await sb
          .from("coupon_configs")
          .select("name, offer_description, offer_value")
          .eq("id", qr.coupon_config_id)
          .maybeSingle();
        if (cfg) offer = cfg;
      }
    }

    return json({
      valid:             true,
      feedback_id:       fb.id,
      coupon_code:       fb.coupon_code,
      original_rating:   fb.score,
      discount_pct:      offer.offer_value ?? null,
      offer_description: offer.offer_description,
    });
  } catch (err) {
    console.error("pos-coupon-validate error:", err);
    return json({ error: "Error interno del servidor" }, 500);
  }
});
