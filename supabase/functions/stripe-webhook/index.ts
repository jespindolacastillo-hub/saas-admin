import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@13.11.0?api_version=2023-10-16&target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

const stripe = new Stripe(stripeSecret, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret)

    console.log(`Webhook received: ${event.type}`);

    if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.updated') {
      const session = event.data.object
      const { tenant_id, plan } = session.metadata || {}

      if (tenant_id) {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        console.log(`Updating tenant ${tenant_id} to plan ${plan || 'growth'}`);

        const { error } = await supabaseAdmin
          .from('tenants')
          .update({ 
            plan: plan || 'growth', 
            subscription_status: 'active' 
          })
          .eq('id', tenant_id)

        if (error) throw error
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { 'Content-Type': 'application/json' },
      status: 200 
    })
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { 'Content-Type': 'application/json' },
      status: 400 
    })
  }
})
