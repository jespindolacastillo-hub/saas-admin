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
      email,
      subject,
      message,
      from_name,
      actor_email,
      campaign_id,
    } = await req.json();

    if (!feedback_id || !tenant_id || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Faltan campos: feedback_id, tenant_id, email, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY no configurado en secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: #f7f8fc; border-radius: 12px; padding: 24px 28px;">
          ${message
            .split("\n")
            .filter((l: string) => l.trim())
            .map((l: string) => `<p style="margin: 0 0 14px; color: #0D0D12; font-size: 15px; line-height: 1.6;">${l}</p>`)
            .join("")}
        </div>
        <p style="font-size: 11px; color: #9CA3AF; margin-top: 20px; text-align: center;">
          Powered by <a href="https://retelio.com.mx" style="color: #00C9A7; text-decoration: none;">Retelio</a>
        </p>
      </div>
    `;

    const fromLabel = from_name ? `${from_name} via Retelio` : "Retelio";

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromLabel} <noreply@retelio.com.mx>`,
        to:      [email],
        subject: subject || "Tienes un mensaje de nosotros",
        html:    htmlBody,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.json();
      console.error("Resend error:", err);
      return new Response(
        JSON.stringify({ error: err.message || "Error al enviar email" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();
    await supabase
      .from("feedbacks")
      .update({
        recovery_status:  "contacted",
        recovery_channel: "email",
        recovery_actor:   actor_email ?? "sistema",
        recovery_at:      now,
        recovery_sent:    true,
      })
      .eq("id", feedback_id)
      .eq("tenant_id", tenant_id);

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("send-campaign-email error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
