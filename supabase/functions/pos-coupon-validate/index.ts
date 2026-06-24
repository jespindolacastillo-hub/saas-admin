import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// Called by POS when cashier scans/types a coupon code.
// Returns validity + discount info. Does NOT mark as redeemed — use pos-coupon-redeem for that.
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

    // Resolve store
    const { data: store } = await sb
      .from("Tiendas_Catalogo")
      .select("id, tenant_id")
      .eq("api_key", api_key)
      .eq("pos_enabled", true)
      .single();

    if (!store) return json({ valid: false, reason: "api_key inválida" }, 401);

    // Look up the feedback that owns this coupon
    const { data: fb } = await sb
      .from("Feedback")
      .select("id, coupon_code, coupon_redeemed, coupon_redeemed_at, score, coupon_config_id, location_id")
      .eq("coupon_code", coupon_code.trim().toUpperCase())
      .eq("tenant_id", store.tenant_id)
      .maybeSingle();

    if (!fb) return json({ valid: false, reason: "Código no encontrado" });

    if (fb.coupon_redeemed) {
      return json({
        valid:            false,
        reason:           "already_redeemed",
        redeemed_at:      fb.coupon_redeemed_at,
      });
    }

    // Fetch coupon config for offer details
    let offer: Record<string, unknown> = { offer_description: "Descuento especial", offer_value: null };
    if (fb.coupon_config_id) {
      const { data: cfg } = await sb
        .from("coupon_configs")
        .select("name, offer_description, offer_value, validity_days")
        .eq("id", fb.coupon_config_id)
        .maybeSingle();
      if (cfg) offer = cfg;
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
