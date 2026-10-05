# AdSpark Pro: deploy to Vercel
Structure: `public/index.html` (app UI) · `api/analyze.js` (scrape + AI analysis + copy) · `api/copy.js` (Bangladesh-tuned ad copy) · `api/publish.js` (Meta Ads) · `api/higgsfield/[...path].js` (video proxy).

1. Push this folder to a GitHub repo (or run `npx vercel` inside it).
2. In Vercel: Add New > Project > import the repo. Framework preset: Other. No build command.
3. Add environment variables, then redeploy:
   - `ANTHROPIC_API_KEY` (required for website analysis)
   - `HIGGSFIELD_API_BASE` (the Higgsfield API base URL from their docs)
   - optional: `ANTHROPIC_MODEL`, `META_GRAPH_VERSION` (check Meta's current version)
4. Open the site > Settings: paste your Higgsfield key, Meta access token (needs `ads_management`), ad account ID, Page ID, daily budget. Turn demo mode off.
5. Paste a website URL > Analyze > pick a hook > Generate video > Publish. Publishing defaults to a paused draft; switch to Active in Settings.

Notes: the Higgsfield request shape in `public/index.html` (`/generations`) is a placeholder; adjust to their docs. Live Meta publishing for other people's accounts needs Meta app review. Keys saved in Settings stay in the browser and are sent to your own `/api` routes per request.

## Google sign-in and history (Supabase)
1. Create a free project at supabase.com. SQL Editor: run `supabase/schema.sql`.
2. Authentication > Providers > Google: enable it with an OAuth client from Google Cloud Console (type Web). Add Supabase's callback URL (`https://<project>.supabase.co/auth/v1/callback`) as an authorized redirect URI.
3. Authentication > URL Configuration: set Site URL and a redirect URL to your Vercel domain.
4. Put the project URL and anon key in `public/config.js`, and also set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Vercel env vars (the API routes use them to check who is calling).

## Super admin panel (users + credits)
1. Supabase SQL Editor: run `supabase/admin.sql`, then make yourself admin: `update public.profiles set role='super_admin' where email='YOU@example.com';`
2. Vercel env var: `SUPABASE_SERVICE_KEY` = the **service_role** key (Supabase > Settings > API). Server only; never put it in `config.js`. Redeploy.
3. Open `/admin.html`: create users (email + password), add / deduct / set credits, block, reset password, make admin, delete, see credit log.
4. Users sign in on the main page with email + password (or Google with the same email). New Google sign-ups start with 0 credits.
Credit costs per action are set in the `_auth` calls: analyze 2, copy 1, audit 1 (admins are free). Video generation uses the user's own Higgsfield key and is not metered yet.
