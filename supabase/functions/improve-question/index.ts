import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { question, bizType, areaName } = await req.json();

    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: "No question provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const context = [bizType, areaName].filter(Boolean).join(" — ");
    const prompt = `Mejora la siguiente pregunta de feedback para clientes. La pregunta se mostrará en un formulario QR en un negocio${context ? ` (${context})` : ""}.

Reglas:
- Corrige ortografía y gramática
- Hazla clara, directa y amigable
- Máximo 12 palabras
- Termina en signo de interrogación
- No expliques nada, solo devuelve la pregunta mejorada

Pregunta original: "${question.trim()}"

Pregunta mejorada:`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const improved = data?.content?.[0]?.text?.trim() ?? question;

    return new Response(JSON.stringify({ improved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
