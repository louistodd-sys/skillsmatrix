import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

  const orgs = await base44.entities.Organisation.filter({ id: user.organisation_id });
  if (!orgs.length) return Response.json({ error: 'Organisation not found' }, { status: 404 });
  const org = orgs[0];

  if (!org.stripe_customer_id) {
    return Response.json({ error: 'No Stripe customer found. Please upgrade to a paid plan first.' }, { status: 400 });
  }

  const origin = req.headers.get('origin') || 'https://skillsmatrixapp.com';

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${origin}/settings?tab=billing`,
  });

  return Response.json({ url: session.url });
});