import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

console.log("Stripe Checkout Function Started!");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2022-11-15',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const { tenant_id, plan, user_email } = await req.json()

    // Definir el ID del producto/precio de Stripe según el plan escogido
    // Para simplificar, usaremos un precio fijo si no se especifica
    const priceId = plan === 'growth' ? 'price_1GrowthID' : 'price_1StarterID';

    console.log(`Creating checkout session for tenant: ${tenant_id}, plan: ${plan}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user_email,
      line_items: [
        {
          price: 'price_1R6m76RQUjor4yYOcUo9T97l', // REEMPLAZAR con el Price ID real de tu Dashboard de Stripe
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `https://ianps.netlify.app/ajustes?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `https://ianps.netlify.app/ajustes?canceled=true`,
      metadata: {
        tenant_id: tenant_id,
        plan: plan
      },
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error("Error creating stripe session:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
