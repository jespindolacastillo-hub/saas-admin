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
      order_ref,
      channel,
      customer_phone,
    } = await req.json();

    if (!api_key || !channel) {
      return json({ error: "Faltan campos: api_key, channel" }, 400);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: store, error: storeErr } = await sb
      .from("Tiendas_Catalogo")
      .select("id, tenant_id, nombre, qr_code_id")
      .eq("api_key", api_key)
      .eq("pos_enabled", true)
      .single();

    if (storeErr || !store)       return json({ error: "api_key inválida" }, 401);
    if (!store.qr_code_id)        return json({ error: "Tienda sin QR configurado" }, 500);

    const feedbackBase = Deno.env.get("FEEDBACK_BASE_URL") ?? "https://admin.retelio.app/f";
    const feedbackUrl  = order_ref
      ? `${feedbackBase}/${store.qr_code_id}?ref=${encodeURIComponent(order_ref)}&ch=${channel}`
      : `${feedbackBase}/${store.qr_code_id}?ch=${channel}`;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(feedbackUrl)}`;

    let whatsappUrl: string | null = null;
    let whatsappMessage: string | null = null;
    if (channel === "delivery" && customer_phone) {
      const cleaned = customer_phone.replace(/\D/g, "");
      const msg = `¡Gracias por tu pedido en ${store.nombre}! 🛍️\nCuéntanos cómo te fue: ${feedbackUrl}`;
      whatsappUrl     = `https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(msg)}`;
      whatsappMessage = msg;
    }

    return json({
      store_id:         store.id,
      store_name:       store.nombre,
      feedback_url:     feedbackUrl,
      qr_url:           qrUrl,
      whatsapp_url:     whatsappUrl,
      whatsapp_message: whatsappMessage,
    });
  } catch (err) {
    console.error("pos-feedback-link error:", err);
    return json({ error: "Error interno del servidor" }, 500);
  }
});
