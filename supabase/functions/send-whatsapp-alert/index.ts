import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAR_EMOJI: Record<number, string> = { 1: "😤", 2: "😕", 3: "😐", 4: "😊", 5: "🤩" };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      tenant_id,
      location_id,
      qr_label,
      score,
      comment,
      whatsapp_number,
    } = await req.json();

    // ── Validations ────────────────────────────────────────────────────────
    if (!whatsapp_number) {
      return new Response(
        JSON.stringify({ error: "whatsapp_number not configured for this location" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!score || score > 2) {
      return new Response(
        JSON.stringify({ error: "Alert only sent for score ≤ 2" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Twilio credentials ─────────────────────────────────────────────────
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken  = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM"); // e.g. "whatsapp:+14155238886"

    if (!accountSid || !authToken || !fromNumber) {
      console.error("Twilio credentials missing");
      return new Response(
        JSON.stringify({ error: "Twilio not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build message ──────────────────────────────────────────────────────
    const emoji = STAR_EMOJI[score] ?? "⚠️";
    const area  = qr_label ? `*${qr_label}*` : "tu negocio";
    const msg   = [
      `${emoji} *Alerta Retelio — Feedback crítico*`,
      ``,
      `📍 Área: ${area}`,
      `⭐ Calificación: ${score}/5`,
      comment ? `💬 Comentario: "${comment}"` : null,
      ``,
      `Responde rápido — tienes <60 segundos para marcar la diferencia.`,
    ]
      .filter((l) => l !== null)
      .join("\n");

    // ── Send via Twilio ────────────────────────────────────────────────────
    const to = `whatsapp:+${whatsapp_number.replace(/\D/g, "")}`;

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: fromNumber, To: to, Body: msg }),
      }
    );

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Twilio error:", twilioData);
      return new Response(
        JSON.stringify({ error: twilioData.message ?? "Twilio error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, sid: twilioData.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("send-whatsapp-alert error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
