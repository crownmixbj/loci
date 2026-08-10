/**
 * Posts a Slack alert when a driver application is submitted.
 *
 * Deployed to Supabase Edge Functions (Deno):
 *
 *   supabase functions deploy notify-application
 *   supabase secrets set SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
 *
 * The webhook URL is a secret — anyone holding it can post into your channel —
 * so it lives in Edge Function secrets, never in the repo or the app bundle.
 *
 * Called by the `on_driver_application_created` trigger in
 * `05_storage_and_alerts.sql`.
 */

type ApplicationPayload = {
  reference?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  state?: string;
  base_city?: string | null;
  vehicle_type?: string;
  submitted_at?: string;
};

/**
 * Slack renders mrkdwn, so a name containing `<` or `&` can break the layout or
 * inject a fake link. Escaping is Slack's documented requirement, not optional.
 */
function escapeSlack(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const field = (label: string, value: string | null | undefined) => ({
  type: 'mrkdwn',
  text: `*${label}*\n${value ? escapeSlack(String(value)) : '—'}`,
});

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhook = Deno.env.get('SLACK_WEBHOOK_URL');

  if (!webhook) {
    /*
     * 200, not 500. The caller is a database trigger with no one to read an
     * error, and returning a failure would fill the Postgres log with noise
     * about a feature that simply isn't configured yet.
     */
    console.warn('SLACK_WEBHOOK_URL is not set — alert skipped.');
    return new Response(JSON.stringify({ skipped: 'no webhook configured' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: ApplicationPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const dashboardUrl = Deno.env.get('LOCI_APP_URL');

  const message = {
    text: `New driver application: ${payload.full_name ?? 'Unknown'} (${payload.reference ?? '—'})`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🚚 New driver application', emoji: true },
      },
      {
        type: 'section',
        fields: [
          field('Applicant', payload.full_name),
          field('Reference', payload.reference),
          field('Phone', payload.phone),
          field('Email', payload.email),
          field('Operating in', payload.base_city ?? payload.state),
          field('Vehicle', payload.vehicle_type),
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            /*
             * States the promise in the alert itself, so whoever sees it knows
             * the clock is running rather than treating it as FYI.
             */
            text: dashboardUrl
              ? `Review within 7 working days — <${dashboardUrl}/admin|open the dashboard>`
              : 'Review within 7 working days — open the Applications tab in LOCI',
          },
        ],
      },
    ],
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Slack rejected the message', response.status, detail);
    return new Response(JSON.stringify({ error: 'slack rejected', status: response.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
