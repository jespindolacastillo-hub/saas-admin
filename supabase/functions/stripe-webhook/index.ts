import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  try {
    const body = await req.text()
    const event = stripe.webhooks.constructEvent(body, signature, endpointSecret)

    // Solo nos interesa cuando la suscripción se crea o se actualiza exitosamente
    if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.updated') {
      const session = event.data.object
      const { tenant_id, plan } = session.metadata

      if (tenant_id) {
        // Conectar a Supabase con la Service Role Key para saltar el RLS
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        console.log(`Updating tenant ${tenant_id} to plan ${plan}`);

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

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
