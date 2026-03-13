import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@13.11.0?api_version=2023-10-16&target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const { tenant_id, plan, user_email } = await req.json()

    console.log(`Creating session for: ${tenant_id}, user: ${user_email}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user_email,
      line_items: [
        {
          price: 'price_1TAFFvQUjor4yYOnrWxAVRTw',
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `https://ianps.netlify.app/ajustes?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `https://ianps.netlify.app/ajustes?canceled=true`,
      metadata: {
        tenant_id: tenant_id,
        plan: plan || 'growth'
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
    console.error("Stripe Checkout Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
