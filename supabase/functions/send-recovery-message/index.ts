import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      feedback_id,
      tenant_id,
      phone,
      message,
      channel,   // "whatsapp" | "sms"
      note,
      actor_email,
    } = await req.json();

    if (!feedback_id || !tenant_id || !phone || !message) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: feedback_id, tenant_id, phone, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Twilio credentials ────────────────────────────────────────────────────
    const accountSid    = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken     = Deno.env.get("TWILIO_AUTH_TOKEN");
    const waFrom        = Deno.env.get("TWILIO_WHATSAPP_FROM"); // e.g. "whatsapp:+14155238886"
    const smsFrom       = Deno.env.get("TWILIO_SMS_FROM") ?? waFrom?.replace("whatsapp:", "");

    if (!accountSid || !authToken) {
      return new Response(
        JSON.stringify({ error: "Twilio no configurado en Supabase secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Format phone ─────────────────────────────────────────────────────────
    const digits = phone.replace(/\D/g, "");
    const e164   = digits.startsWith("52") ? `+${digits}` : `+52${digits}`;

    // ── Determine from/to based on channel ───────────────────────────────────
    const isWhatsApp = channel === "whatsapp";
    const to   = isWhatsApp ? `whatsapp:${e164}` : e164;
    const from = isWhatsApp ? (waFrom ?? "") : (smsFrom ?? "");

    if (!from) {
      return new Response(
        JSON.stringify({ error: `Canal ${channel} no configurado. Agrega TWILIO_WHATSAPP_FROM o TWILIO_SMS_FROM a los secrets.` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Send via Twilio ───────────────────────────────────────────────────────
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: from, To: to, Body: message }),
      }
    );

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Twilio error:", twilioData);
      return new Response(
        JSON.stringify({
          error: twilioData.message ?? "Error en Twilio",
          twilio_code: twilioData.code,
          twilio_more_info: twilioData.more_info,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Update feedback record in Supabase ───────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();
    const { error: dbError } = await supabase
      .from("feedbacks")
      .update({
        recovery_status:  "contacted",
        recovery_channel: channel,
        recovery_note:    note ?? "Mensaje enviado por la plataforma",
        recovery_actor:   actor_email ?? "sistema",
        recovery_at:      now,
        recovery_sent:    true,
      })
      .eq("id", feedback_id)
      .eq("tenant_id", tenant_id);

    if (dbError) {
      console.error("DB update error:", dbError);
      // Message was sent but DB failed — still return ok with warning
      return new Response(
        JSON.stringify({ ok: true, sid: twilioData.sid, warning: "Mensaje enviado pero no se pudo actualizar el registro: " + dbError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, sid: twilioData.sid, status: twilioData.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("send-recovery-message error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
