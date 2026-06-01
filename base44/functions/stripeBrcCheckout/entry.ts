import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

const BRC_PRICE_ID = Deno.env.get('STRIPE_PRICE_BRC_MONTHLY');

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

  const { success_url, cancel_url } = await req.json();

  if (!BRC_PRICE_ID) {
    return Response.json({ error: 'Missing Stripe price ID for BRC' }, { status: 500 });
  }

  const orgs = await base44.entities.Organisation.filter({ id: user.organisation_id });
  if (!orgs.length) return Response.json({ error: 'Organisation not found' }, { status: 404 });
  const org = orgs[0];

  // Reuse existing Stripe customer (shared with Skills Matrix subscription)
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
  // Sharing a Stripe customer means both SM and BRC charges appear on one invoice automatically
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: BRC_PRICE_ID, quantity: 1 }],
    automatic_tax: { enabled: true },
    subscription_data: {
      metadata: { organisation_id: org.id, product: 'brc_compliance', billing_interval: 'monthly' },
    },
    success_url: success_url || `${req.headers.get('origin')}/settings?tab=general&brc=success`,
    cancel_url:  cancel_url  || `${req.headers.get('origin')}/upgrade-brc?cancelled=1`,
    metadata: { organisation_id: org.id, product: 'brc_compliance', billing_interval: 'monthly' },
  });

  return Response.json({ url: session.url });
});
