# Clean Database Validation

`npm run validate:clean-db` applies every SQL file in `supabase/migrations/` to an empty database, then runs the startup schema validator against that freshly built schema.

## Required Database

Use a throwaway Postgres or Supabase database only. The script drops and recreates the `public` schema.

Provide one of these environment variables:

- `CLEAN_DATABASE_URL`: preferred for this check
- `DATABASE_URL`: fallback if `CLEAN_DATABASE_URL` is not set

Example:

```bash
CLEAN_DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require" npm run validate:clean-db
```

## Expected Result

The command should end with:

```text
Clean database validation passed.
```

If the command fails, fix the migration or canonical `db/schema.sql` mismatch before deploying. Do not run this against production or any database containing customer data.
