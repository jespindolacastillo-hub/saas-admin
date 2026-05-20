import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

async function verifyTwilioSignature(authToken: string, signature: string, url: string, params: Record<string, string>): Promise<boolean> {
  // Twilio spec: sort params alphabetically, append key+value to URL, sign with HMAC-SHA1
  const str = url + Object.keys(params).sort().map(k => k + (params[k] ?? '')).join('');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(str));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === signature;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Twilio sends data as application/x-www-form-urlencoded
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [k, v] of formData.entries()) params[k] = v as string;

    // ── Verify request is genuinely from Twilio ──────────────────────────────
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (authToken) {
      const signature = req.headers.get("X-Twilio-Signature") ?? "";
      const valid = await verifyTwilioSignature(authToken, signature, req.url, params);
      if (!valid) {
        console.warn("twilio-webhook: invalid signature — request rejected");
        return new Response("Forbidden", { status: 403 });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const from = params["From"]; // e.g. "whatsapp:+52155..."
    const body = params["Body"];
    const to   = params["To"];   // Our business number

    if (!from || !body) {
      return new Response("Invalid request", { status: 400 });
    }

    const customerPhone = from.replace(/^whatsapp:\+?/, "").replace("+", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Find the most recent active recovery for this phone ──────────────────
    // We look for feedbacks where the last action was 'contacted' (sent)
    const { data: feedback, error: findError } = await supabase
      .from("feedbacks")
      .select("id, tenant_id, location_id, recovery_status")
      .eq("contact_phone", customerPhone)
      .in("recovery_status", ["contacted", "responded", "committed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error("Error finding feedback:", findError);
      return new Response("Error", { status: 500 });
    }

    if (feedback) {
      // Update status to 'responded'
      await supabase
        .from("feedbacks")
        .update({
          recovery_status: "responded",
          // We could append the message to a notes field or a messages table
          // For now, let's just mark it as responded to alert the manager
        })
        .eq("id", feedback.id);
      
      console.log(`Feedback ${feedback.id} marked as responded from ${customerPhone}`);
    } else {
      console.log(`No active feedback found for phone ${customerPhone}`);
    }

    // Twilio expects a TwiML response (even if empty)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

    return new Response(twiml, {
      headers: { "Content-Type": "text/xml" },
    });

  } catch (err) {
    console.error("twilio-webhook error:", err);
    return new Response(String(err), { status: 500 });
  }
});
