import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import Stripe from 'npm:stripe@^16.1.0'
import { createClient } from 'npm:@supabase/supabase-js@^2.39.0'

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

const stripe = new Stripe(stripeSecret)

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  try {
    const body = await req.text()
    const event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret)

    console.log(`Webhook received: ${event.type}`)

    if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.updated') {
      const session = event.data.object
      const metadata = session.metadata || {}
      const tenantIdentifier = metadata.tenant_id
      const plan = metadata.plan || 'growth'

      let trace = {
        event: event.type,
        received_metadata: metadata,
        step: 'init'
      }

      if (!tenantIdentifier) {
        return new Response(JSON.stringify({ received: true, error: 'missing_tenant_id', trace }), { status: 200 })
      }

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // 1. Try by UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantIdentifier)
      if (isUuid) {
        const { data, error } = await supabaseAdmin
          .from('tenants')
          .update({ plan: plan, subscription_status: 'active' })
          .eq('id', tenantIdentifier)
          .select()
        
        if (!error && data && data.length > 0) {
          return new Response(JSON.stringify({ received: true, updated: 'id', id: tenantIdentifier, plan, trace }), { status: 200 })
        }
      }

      // 2. Try by Domain
      const { data, error } = await supabaseAdmin
        .from('tenants')
        .update({ plan: plan, subscription_status: 'active' })
        .eq('domain', tenantIdentifier)
        .select()

      if (!error && data && data.length > 0) {
        return new Response(JSON.stringify({ received: true, updated: 'domain', domain: tenantIdentifier, plan, trace }), { status: 200 })
      }

      return new Response(JSON.stringify({ 
        received: true, 
        error: 'tenant_not_found', 
        searched_for: tenantIdentifier,
        is_uuid_format: isUuid,
        trace 
      }), { status: 200 })
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { 'Content-Type': 'application/json' },
      status: 200 
    })
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`)
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { 'Content-Type': 'application/json' },
      status: 400 
    })
  }
})
