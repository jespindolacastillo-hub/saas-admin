import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // ── Check usage limit ──────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const period = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Get tenant plan + current usage
    const [tenantRes, usageRes] = await Promise.all([
      supabase.from("tenants").select("plan, plan_status, trial_ends_at").eq("id", tenant_id).single(),
      supabase.from("tenant_whatsapp_usage").select("used_count, included_limit, addon_purchased").eq("tenant_id", tenant_id).eq("period", period).maybeSingle(),
    ]);

    const planSlug = tenantRes.data?.plan || "trial";
    const planStatus = tenantRes.data?.plan_status;
    const trialEndsAt = tenantRes.data?.trial_ends_at;

    // Determine limit
    const PLAN_WA_LIMITS: Record<string, number> = {
      trial: 20, starter: 50, growth: 200, enterprise: -1,
    };
    const isTrial = planStatus === "trial" && trialEndsAt && new Date(trialEndsAt) > new Date();
    const includedLimit = isTrial ? 20 : (PLAN_WA_LIMITS[planSlug] ?? 20);
    const addonPurchased = usageRes.data?.addon_purchased ?? 0;
    const totalLimit = includedLimit === -1 ? Infinity : includedLimit + addonPurchased;
    const usedCount = usageRes.data?.used_count ?? 0;

    if (usedCount >= totalLimit) {
      return new Response(
        JSON.stringify({ error: "WhatsApp limit reached for this period", used: usedCount, limit: totalLimit }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Twilio credentials ─────────────────────────────────────────────────
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken  = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM");

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

    // ── Track usage ────────────────────────────────────────────────────────
    if (usageRes.data) {
      await supabase
        .from("tenant_whatsapp_usage")
        .update({ used_count: usedCount + 1 })
        .eq("tenant_id", tenant_id)
        .eq("period", period);
    } else {
      await supabase.from("tenant_whatsapp_usage").insert({
        tenant_id,
        period,
        included_limit: includedLimit,
        addon_purchased: 0,
        used_count: 1,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, sid: twilioData.sid, used: usedCount + 1, limit: totalLimit }),
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
