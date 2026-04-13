import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Twilio sends data as application/x-www-form-urlencoded
    const formData = await req.formData();
    const from = formData.get("From") as string; // e.g. "whatsapp:+52155..."
    const body = formData.get("Body") as string;
    const to = formData.get("To") as string;     // Our business number

    if (!from || !body) {
      return new Response("Invalid request", { status: 400 });
    }

    const customerPhone = from.replace("whatsapp:+", "").replace("+", "");

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
