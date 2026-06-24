import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// Called by POS when closing a sale to get the feedback URL/QR for the ticket.
// Auth: api_key per store (returned by pos-activate, stored in POS system).
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
      api_key,        // store's api_key
      order_ref,      // POS ticket/order reference (string), e.g. "TKT-0042"
      channel,        // "ticket" | "delivery"
      customer_phone, // optional — used to build WhatsApp deep link
    } = await req.json();

    if (!api_key || !channel) {
      return json({ error: "Faltan campos: api_key, channel" }, 400);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Resolve store by api_key
    const { data: store, error: storeErr } = await sb
      .from("Tiendas_Catalogo")
      .select("id, tenant_id, nombre")
      .eq("api_key", api_key)
      .eq("pos_enabled", true)
      .single();

    if (storeErr || !store) return json({ error: "api_key inválida" }, 401);

    const feedbackBase = Deno.env.get("FEEDBACK_BASE_URL") ?? "https://feedback.retelio.app";
    const params = new URLSearchParams({
      tid: store.tenant_id,
      t:   store.id,
      ch:  channel,
      ...(order_ref      ? { ref: order_ref }        : {}),
    });
    const feedbackUrl = `${feedbackBase}/?${params.toString()}`;

    // QR image via free API (300x300, suitable for thermal printing)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(feedbackUrl)}`;

    // WhatsApp deep link — only when channel=delivery and phone provided
    let whatsappUrl: string | null = null;
    let whatsappMessage: string | null = null;
    if (channel === "delivery" && customer_phone) {
      const cleaned = customer_phone.replace(/\D/g, "");
      const text = encodeURIComponent(
        `¡Gracias por tu pedido en ${store.nombre}! 🛍️\nCuéntanos cómo te fue: ${feedbackUrl}`
      );
      whatsappUrl = `https://api.whatsapp.com/send?phone=${cleaned}&text=${text}`;
      whatsappMessage = `¡Gracias por tu pedido en ${store.nombre}! 🛍️\nCuéntanos cómo te fue: ${feedbackUrl}`;
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
