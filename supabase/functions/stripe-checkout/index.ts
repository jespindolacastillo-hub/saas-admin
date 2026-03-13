import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import Stripe from 'npm:stripe@^16.1.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY is missing')

    const stripe = new Stripe(stripeSecret)

    const { tenant_id, plan, user_email } = await req.json()

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
