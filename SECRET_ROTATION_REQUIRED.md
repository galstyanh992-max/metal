# Secret Rotation — Required External Actions

> **Status: BLOCKED_EXTERNAL**
>
> The source code has been remediated (secrets removed, fail-closed validation
> added, hardcoded credentials eliminated). The following actions require
> access to external provider dashboards (Supabase, Vercel, email/WhatsApp)
> and CANNOT be performed from the local codebase. The owner MUST complete
> them.

## 1. Rotate Supabase / PostgreSQL database password

The Supabase session-pooler password was previously committed to `worklog.md`
and `.env` (now redacted in source, but the value itself is compromised in
git history until rewritten).

**Action:**
1. Open the Supabase dashboard → Project Settings → Database.
2. Reset the `postgres` user password (or the dedicated app user's password).
3. Update `DATABASE_URL` in:
   - `.env.local` (local development)
   - Vercel project environment variables (production + preview + development)
4. Verify the app connects with the new password.

## 2. Rotate NEXTAUTH_SECRET

The previous `NEXTAUTH_SECRET` was the hardcoded placeholder
`dev-secret-change-in-production` (now removed from source and `vercel.json`).

**Action:**
1. Generate a new secret:
   ```sh
   openssl rand -base64 32
   # or
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. Set `NEXTAUTH_SECRET` in Vercel project environment variables
   (production + preview + development).
3. Restart the deployment. All existing JWTs become invalid — users will need
   to log in again (this is intended; it invalidates any session minted with
   the leaked secret).

## 3. Rotate compromised user passwords

The seeded user passwords (`admin123`, `operator123`, `warehouse123`) were
committed to git history. Even though source no longer references them, the
values are known.

**Action:**
1. Run `scripts/reset-passwords.ts` with env-supplied passwords:
   ```sh
   ADMIN_PASSWORD="<new strong password>" \
   OPERATOR_PASSWORD="<new strong password>" \
   WAREHOUSE_PASSWORD="<new strong password>" \
   npx tsx scripts/reset-passwords.ts
   ```
   Or let it generate cryptographically secure random passwords and capture
   them from the terminal output.
2. Distribute the new credentials to users over a secure out-of-band channel.

## 4. Revoke Vercel token / rotate GitHub PAT (if still active)

A `VERCEL_TOKEN` was previously used to deploy the project. If the token is
still active, revoke it.

**Action:**
1. Vercel → Account Settings → Tokens → revoke the token.
2. GitHub → Settings → Developer settings → Personal access tokens → revoke
   any token that was used for CI/deployment.
3. Generate new tokens only if needed, with minimum required scope, and store
   them in GitHub Actions secrets (not in the repo).

## 5. Configure email/WhatsApp providers (or accept NOT_CONFIGURED)

The comms adapters now return `NOT_CONFIGURED` honestly when providers are
not set. To enable real sending:

**Action:**
1. Email — set `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`,
   `EMAIL_SMTP_PASS`, `EMAIL_FROM` in Vercel env vars. Install `nodemailer`
   and wire the transport in `src/lib/comms/adapters.ts`.
2. WhatsApp — set `WHATSAPP_BUSINESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`
   in Vercel env vars.

## 6. Git history remediation (optional, requires force-push coordination)

Secrets were removed from the **current tree**, but they remain in git
history. To purge them:

**Action (coordinate with all collaborators first — this rewrites history):**
1. Install `git-filter-repo`:
   ```sh
   pip install git-filter-repo
   ```
2. Create a replacements file:
   ```
   # replacements.txt
   Prado006-006==>***REDACTED***
   dev-secret-change-in-production==>***REDACTED***
   admin123==>***REDACTED***
   operator123==>***REDACTED***
   warehouse123==>***REDACTED***
   postgresql://postgres.scxvufvwjumkqjhhamyd:***==>postgresql://postgres.***:***@***
   ```
3. Run:
   ```sh
   git filter-repo --replace-text replacements.txt
   git push --force-with-lease origin main
   ```
4. Force all collaborators to re-clone.

> If history rewriting is not feasible, ensure the rotated credentials (steps
> 1–4) are in place — the leaked values in history become useless once the
> underlying credentials are rotated. This is the minimum acceptable state.