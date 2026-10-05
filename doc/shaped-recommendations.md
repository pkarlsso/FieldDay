# Shaped recommendation data export

FieldDay uses Shaped's custom-table path so the mobile app never receives a Shaped API key. The backend exports three JSON Lines files:

- `users.jsonl`: sports, per-sport skill levels, social rating, and account creation time.
- `sessions.jsonl`: sport, time, coordinate pair, skill range, tags, availability, and status.
- `interactions.jsonl`: session joins and submitted ratings.

The export intentionally omits email addresses, passwords, authentication tokens, profile images, and readable location names. The Shaped engine receives only the attributes needed to rank sessions.

## Create the export

Set `MONGODB_URI` in `backend/.env`, then run:

```bash
npm run export:shaped
```

Files are written to `output/shaped/`. A different output directory can be supplied with:

```bash
node scripts/export-shaped-data.mjs /path/to/export
```

## Load Shaped custom tables

Create a Shaped API key in the Shaped console, keep it outside Git, and use the Shaped CLI to upload the generated files. The Shaped documentation describes the custom-table command as:

```bash
shaped create-table-from-uri --name fieldday_sessions --path output/shaped/sessions.jsonl --type jsonl
```

Create corresponding `fieldday_users` and `fieldday_interactions` tables, connect them to a recommendation engine, and store the resulting API key only in backend configuration or AWS Secrets Manager. The follow-up backend query and frontend recommendation screen are tracked by issues #174 and #208.
