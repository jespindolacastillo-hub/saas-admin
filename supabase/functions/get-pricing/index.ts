import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "public, max-age=300", // cache 5 min
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [plansRes, addonsRes] = await Promise.all([
      supabase
        .from("pricing_plans")
        .select("slug,name,price_monthly,price_annual,currency,whatsapp_limit,users_limit,trial_days,features,sort_order")
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("whatsapp_addons")
        .select("slug,name,messages_count,price,currency")
        .eq("active", true)
        .order("sort_order"),
    ]);

    if (plansRes.error) throw plansRes.error;
    if (addonsRes.error) throw addonsRes.error;

    return new Response(
      JSON.stringify({
        plans: plansRes.data,
        addons: addonsRes.data,
        currency: "MXN",
        trial_days: 14,
        updated_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
