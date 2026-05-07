import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { user_email, user_name, org_name } = await req.json();

  await base44.integrations.Core.SendEmail({
    to: user_email,
    from_name: 'Skills Matrix App',
    subject: `Welcome to Skills Matrix App, ${user_name}!`,
    body: `
Hi ${user_name},

Welcome to Skills Matrix App! 🎉

Your organisation "${org_name}" is all set up and ready to go.

Here's what you can do next:
• Add your employees to the skills matrix
• Create skill categories and define the skills your team needs
• Set up teams and assign required skills
• Start assessing your team's proficiency levels

Get started: ${req.headers.get('origin') || 'https://skillsmatrixapp.com'}

If you have any questions, reply to this email — we're here to help.

Best,
The Skills Matrix App Team
    `.trim(),
  });

  return Response.json({ sent: true });
});