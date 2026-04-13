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
      whatsapp_number, // accept both
      message,
      channel,   // "whatsapp" | "sms"
      note,
      actor_email,
    } = await req.json();

    const targetPhone = (whatsapp_number || phone);

    if (!feedback_id || !tenant_id || !targetPhone || !message) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: feedback_id, tenant_id, phone, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isWhatsApp = (channel === "whatsapp" || !channel);
    const to = isWhatsApp ? `whatsapp:+${targetPhone.replace(/\D/g, "")}` : `+${targetPhone.replace(/\D/g, "")}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Check WhatsApp usage limit if channel is whatsapp ─────────────────────
    const period = new Date().toISOString().slice(0, 7);
    let usedCount = 0;
    let totalLimit = Infinity;

    if (isWhatsApp) {
      const [tenantRes, usageRes] = await Promise.all([
        supabase.from("tenants").select("plan, plan_status, trial_ends_at").eq("id", tenant_id).single(),
        supabase.from("tenant_whatsapp_usage").select("used_count, included_limit, addon_purchased").eq("tenant_id", tenant_id).eq("period", period).maybeSingle(),
      ]);

      const planSlug = tenantRes.data?.plan || "trial";
      const planStatus = tenantRes.data?.plan_status;
      const trialEndsAt = tenantRes.data?.trial_ends_at;

      const PLAN_WA_LIMITS: Record<string, number> = {
        trial: 20, starter: 50, growth: 200, enterprise: -1,
      };
      
      const isTrial = planStatus === "trial" && trialEndsAt && new Date(trialEndsAt) > new Date();
      const includedLimit = isTrial ? 20 : (PLAN_WA_LIMITS[planSlug] ?? 20);
      const addonPurchased = usageRes.data?.addon_purchased ?? 0;
      totalLimit = includedLimit === -1 ? Infinity : includedLimit + addonPurchased;
      usedCount = usageRes.data?.used_count ?? 0;

      if (usedCount >= totalLimit) {
        return new Response(
          JSON.stringify({ error: "Límite de mensajes WhatsApp alcanzado para este periodo", used: usedCount, limit: totalLimit }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Twilio credentials ────────────────────────────────────────────────────
    const accountSid    = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken     = Deno.env.get("TWILIO_AUTH_TOKEN");
    const waFrom        = Deno.env.get("TWILIO_WHATSAPP_FROM");
    const smsFrom       = Deno.env.get("TWILIO_SMS_FROM") ?? waFrom?.replace("whatsapp:", "");

    if (!accountSid || !authToken) {
      return new Response(
        JSON.stringify({ error: "Twilio no configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Format phone ─────────────────────────────────────────────────────────
    const from   = isWhatsApp ? (waFrom ?? "") : (smsFrom ?? "");

    if (!from) {
      return new Response(
        JSON.stringify({ error: `Canal ${channel} no configurado.` }),
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
        JSON.stringify({ error: twilioData.message ?? "Error en Twilio" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Track usage ────────────────────────────────────────────────────────
    if (isWhatsApp) {
      const { data: usage } = await supabase.from("tenant_whatsapp_usage").select("id").eq("tenant_id", tenant_id).eq("period", period).maybeSingle();
      if (usage) {
        await supabase.from("tenant_whatsapp_usage").update({ used_count: usedCount + 1 }).eq("id", usage.id);
      } else {
        await supabase.from("tenant_whatsapp_usage").insert({ tenant_id, period, used_count: 1 });
      }
    }

    // ── Update feedback record ───────────────────────────────────────────────
    const now = new Date().toISOString();
    await supabase
      .from("feedbacks")
      .update({
        recovery_status:  "contacted",
        recovery_channel: channel,
        recovery_note:    note ?? "Mensaje enviado por la plataforma",
        recovery_actor:   actor_email ?? "sistema",
        recovery_at:      now,
        recovery_sent:    true,
      })
      .eq("id", feedback_id);

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

