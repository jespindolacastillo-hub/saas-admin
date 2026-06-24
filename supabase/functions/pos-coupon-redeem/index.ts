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
      api_key,
      coupon_code,
      order_amount,
      discount_amount,
      ticket_id,
    } = await req.json();

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

    if (!store) return json({ success: false, reason: "api_key inválida" }, 401);

    const { data: fb } = await sb
      .from("feedbacks")
      .select("id, coupon_redeemed, tenant_id")
      .eq("coupon_code", coupon_code.trim().toUpperCase())
      .eq("tenant_id", store.tenant_id)
      .maybeSingle();

    if (!fb)               return json({ success: false, reason: "Código no encontrado" });
    if (fb.coupon_redeemed) return json({ success: false, reason: "already_redeemed" });

    const now = new Date().toISOString();

    const { error: updateErr } = await sb
      .from("feedbacks")
      .update({
        coupon_redeemed:    true,
        coupon_redeemed_at: now,
        redeemed_amount:    order_amount   ? parseFloat(order_amount)   : null,
        redeemed_ticket_id: ticket_id      ?? null,
        recovery_status:    "resolved",
      })
      .eq("id", fb.id);

    if (updateErr) return json({ success: false, reason: updateErr.message }, 500);

    return json({
      success:         true,
      redeemed_at:     now,
      order_amount:    order_amount    ?? null,
      discount_amount: discount_amount ?? null,
    });
  } catch (err) {
    console.error("pos-coupon-redeem error:", err);
    return json({ error: "Error interno del servidor" }, 500);
  }
});
