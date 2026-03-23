import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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
      actor_email,
    } = await req.json();

    if (!feedback_id || !tenant_id || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Faltan campos: feedback_id, tenant_id, email, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") ?? "465");

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ error: "SMTP no configurado. Agrega SMTP_HOST, SMTP_USER, SMTP_PASS a los secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // HTML body
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: #f7f8fc; border-radius: 12px; padding: 24px 28px;">
          ${message
            .split("\n")
            .filter(l => l.trim())
            .map(l => `<p style="margin: 0 0 14px; color: #0D0D12; font-size: 15px; line-height: 1.6;">${l}</p>`)
            .join("")}
        </div>
        <p style="font-size: 11px; color: #9CA3AF; margin-top: 20px; text-align: center;">
          Powered by <a href="https://retelio.com.mx" style="color: #00C9A7; text-decoration: none;">Retelio</a>
        </p>
      </div>
    `;

    // Send via SMTP (port 465 = SSL)
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port:     smtpPort,
        tls:      true,
        auth: { username: smtpUser, password: smtpPass },
      },
    });

    await client.send({
      from:    `Retelio <${smtpUser}>`,
      to:      email,
      subject: subject || "Tienes un mensaje de nosotros",
      html:    htmlBody,
    });

    await client.close();

    // Update feedback record
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
