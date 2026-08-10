# Edge Functions

Deno, not React Native. They run on Supabase's edge runtime and are excluded
from the app's `tsconfig.json` — type-checking them against React Native's libs
produces nonsense like "Cannot find name 'Deno'".

## notify-application

Posts a Slack message whenever a driver application is inserted. Called by the
`on_driver_application_created` trigger in `../05_storage_and_alerts.sql`.

### Deploy

```bash
npm install -g supabase          # if you don't have the CLI
supabase login
supabase link --project-ref <your-project-ref>

supabase functions deploy notify-application

# The webhook URL is a secret — anyone with it can post to your channel.
supabase secrets set SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."

# Optional: makes the alert link straight to the review dashboard.
supabase secrets set LOCI_APP_URL="https://your-app.pages.dev"
```

Create the webhook at <https://api.slack.com/messaging/webhooks> — "Create an
app" → "Incoming Webhooks" → add one to the channel you want.

### Then point the trigger at it

In the SQL editor, once:

```sql
insert into private.app_settings (key, value) values
  ('edge_url', 'https://<project-ref>.supabase.co/functions/v1'),
  ('service_key', '<your service_role key>')
on conflict (key) do update set value = excluded.value;
```

⚠ The `service_role` key belongs only here and in Edge Function secrets. It
bypasses every RLS policy — it must never reach `.env` or the app bundle.

### Check it

```bash
supabase functions logs notify-application
```

Submitting a driver application should post to Slack within a second or two. If
nothing arrives, the trigger swallows its own errors by design — an alert must
never roll back an application — so look in the Postgres logs for a
`notify_new_driver_application failed` warning.
