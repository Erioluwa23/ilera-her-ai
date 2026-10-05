# Render development database

Provisioned on 5 October 2026 for development and test caller history. This database is hosted separately from the web app, in the same Render workspace and Frankfurt region. No paid plan was selected.

- Name: `ileraher-dev-db`
- Database: `ileraher_dev_db`
- Resource ID: `dpg-db1u8ee7bikc73bnmqh0-a`
- Engine: PostgreSQL 17
- Plan: free
- Dashboard: https://dashboard.render.com/d/dpg-db1u8ee7bikc73bnmqh0-a
- Render expiry: 4 November 2026 at 17:54 UTC (18:54 WAT)

## Connection still required

Render reports the instance as available. Its external connection allowlist is empty, so it currently accepts private-network connections only; the hosted SQL tool cannot query it. The connected Render tools can create and inspect the instance but do not expose its private connection URL. The app is not connected yet. In the database Dashboard, copy **Internal Database URL** and set it as `IVR_DATABASE_URL` in the existing `ilera-her-ai` web service's environment. Do not commit the URL or paste it into chat.

Use the internal URL because both resources are in Frankfurt. External development clients require the external URL, TLS and an explicitly allowed IP address. Keep external access disabled until it is needed. After wiring the app, configure the separate IVR encryption secrets described in [IVR calls](IVR_CALLS.md), initialise the schema through the app and verify its database readiness. A connected database alone does not activate phone calls.

## Move to production

Migrate or upgrade before the free instance expires. Until then, use synthetic test health reports. The schema is ordinary PostgreSQL, and the app reads its connection from `IVR_DATABASE_URL`, so a production switch does not require rewriting storage code.

If test data must be kept, export and restore the app's jobs, profiles and history tables into the production database, preserving `IVR_PROFILE_SECRET` so caller identifiers and encrypted history remain readable. Preserve the temporary session secret if retaining active call results. Otherwise start production with an empty database and fresh secrets. Verify profile unlock, follow-up history, deletion and retention in the destination before removing the development instance. Do not remove the old instance until the migration has been verified.
