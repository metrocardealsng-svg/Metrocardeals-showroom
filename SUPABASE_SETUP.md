# MetroCarDeals live inventory setup

This work is based on the GitHub commit Vercel reported serving at `metrocardeals-vercel.vercel.app`, from repository `metrocardealsng-svg/Metrocardeals-showroom` and branch `claude/magical-gates-t3yk6a`. Do not merge into a different branch without checking Vercel → Project Settings → Git → Production Branch.

## What changed
- The showroom now fetches available cars from `/api/inventory` on initial load and every 10 seconds while open. Price and image changes are stored in Supabase (no new GitHub commit or deployment needed for each edit).
- A mobile-friendly, password-protected `/admin/` lets the authorized owner add and edit cars, select/upload images, set prices and mark vehicles reserved/sold.
- Original cinematic design, car detail dialogs and WhatsApp CTAs are left in place.
- Existing local `data/vehicles.json` is the initial, read-only fallback. A Supabase record with the same vehicle `id` overrides the fallback. Mark any already-sold legacy vehicles as sold before sending traffic to the website.
- Instagram-to-GitHub automated sync, legacy admin key, and legacy API routes are removed. New Instagram posts are **not imported automatically**; upload the originals from your phone. Uploaded images are stored in Supabase Storage, not hotlinked to temporary Instagram CDN URLs.

## One-time owner actions

1. Create a **separate Supabase project** at https://supabase.com/dashboard for MetroCarDeals (do not reuse another app's database). From SQL Editor, execute `supabase/schema.sql`. This creates the vehicle table and the public-read/private-write image bucket. Do not create client write policies.
2. In Authentication → Users → Add user, create your private admin account with email and a strong password. Copy its **User UID (UUID)**. This UID, not your email address, is the only authorized admin ID. Disable public sign-ups or leave them on knowing that any newly registered users will be denied by the server-side UID allowlist.
3. In Supabase Project Settings → API (or API Keys), get the **Project URL**, **anon / publishable key**, and the **service_role / secret server key**. Do not commit or share these secret values. The service role key must stay in Vercel server-side environment variables, never in a browser file or NEXT_PUBLIC variable.
4. In Vercel, open the existing **metrocardeals-vercel** project → Settings → Environment Variables. Set these variables for **Production** (and Preview if preview testing is wanted):
   - `SUPABASE_URL`: full Supabase project URL, for example `https://example.supabase.co`
   - `SUPABASE_ANON_KEY`: Supabase anonymous/publishable API key (safe to expose to the client for authentication).
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role JWT (secret; server use only).
   - `SUPABASE_ADMIN_USER_ID`: exact UID of your authorized admin account.
5. In Vercel → Settings → Git, verify the production branch currently serving `metrocardeals-vercel.vercel.app`. Merge the linked PR into that actual production branch **after** creating the Supabase project, running SQL and adding the four environment variables. Redeploy to make environment variable settings take effect; this is a **one-time code/configuration deployment**. Subsequent price/photo/status updates need no redeploy.
6. Open `https://metrocardeals-vercel.vercel.app/admin/` after deployment. Sign in using the Supabase admin email and password. If you see “Configure Supabase”, check the Vercel environment variables and redeploy.
7. Inspect existing stock. The original code data includes a Toyota RAV4 **2017**. Do **not** silently change that to 2016 without verifying the vehicle. Add the actual RAV4 2016 with its own real photos, price and condition; mark sold stock sold. Only then direct Google Search Ads to the current, verified listing.
8. Confirm on a phone and another browser that new image uploads, price updates, reserve/sold changes and WhatsApp button links work on production. The public site fetches fresh data on navigation/refresh and polls every 10 seconds while visible.
9. Remove obsolete `GH_TOKEN`, `GH_REPO`, `GH_BRANCH`, `ADMIN_KEY`, `IG_ACCESS_TOKEN`, and `IG_USER_ID` from Vercel if they are no longer used by other code. Revoke the old GitHub token and rotate any exposed admin key.
   
## Limits and safeguards
- This is an admin-managed catalog, **not** a live Instagram importer. Original photos can be uploaded directly from the device; the app compresses them to JPEG (up to 2.6 MB). HEIC decoding depends on browser support; export HEIC files to JPEG if they fail.
- The public catalog is read-only. The Vercel API validates the Supabase user's JWT against Supabase Auth and checks its UID against the private owner allowlist before any update or upload. The Supabase table has RLS on with no browser read/write grants. The image bucket is public-read for car photos, but upload goes through the authenticated API.
- Set the exact authenticated owner UUID in Vercel. Merely visiting `/admin/` does not provide access.
- Existing seed inventory is loaded from the static data file. Remove or archive the legacy entries in a subsequent separate code migration after you have reviewed every vehicle; do not delete them blindly.
- A sold or reserved car is hidden from the **available** showroom; it remains editable in admin. Unpublished price/photo changes are never written into GitHub.
- If all four environment variables are absent, the public site shows the existing seed cars and admin writes are disabled. Once the variables are set, you **must** run the SQL schema before publishing; otherwise the inventory endpoint reports unavailable instead of silently showing stale stock. No database secret is exposed to the browser.
