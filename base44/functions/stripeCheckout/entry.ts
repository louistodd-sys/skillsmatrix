import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

const PRICE_IDS = {
  essential:    Deno.env.get('STRIPE_PRICE_ESSENTIAL_MONTHLY'),
  professional: Deno.env.get('STRIPE_PRICE_PROFESSIONAL_MONTHLY'),
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

  const { tier, success_url, cancel_url } = await req.json();

  if (!['essential', 'professional'].includes(tier)) {
    return Response.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const priceId = PRICE_IDS[tier];
  if (!priceId) {
    return Response.json({ error: `Missing Stripe price ID for ${tier}` }, { status: 500 });
  }

  const orgs = await base44.entities.Organisation.filter({ id: user.organisation_id });
  if (!orgs.length) return Response.json({ error: 'Organisation not found' }, { status: 404 });
  const org = orgs[0];

  // Reuse existing Stripe customer if available
  let customerId = org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: org.name,
      metadata: { organisation_id: org.id, user_id: user.id },
    });
    customerId = customer.id;
    await base44.entities.Organisation.update(org.id, { stripe_customer_id: customerId });
  }

  // Direct payment — no trial, pay from day one
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    automatic_tax: { enabled: true },
    subscription_data: {
      metadata: { organisation_id: org.id, tier, billing_interval: 'monthly' },
    },
    success_url: success_url || `${req.headers.get('origin')}/settings?billing=success`,
    cancel_url:  cancel_url  || `${req.headers.get('origin')}/settings?billing=cancelled`,
    metadata: { organisation_id: org.id, tier, billing_interval: 'monthly' },
  });

  return Response.json({ url: session.url });
});
