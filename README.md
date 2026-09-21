# MetroCarDeals Showroom

Static site (design, hero, intro) backed by Supabase for inventory data, image
storage and the admin dashboard. Deployed on Vercel.

## Admin dashboard

`/admin` — sign in and manage the live inventory with no redeploy: add
listings, upload photos, edit price/details, mark a car sold, delete a
listing, and review cars auto-suggested from Instagram. Changes appear on the
public site immediately (it reads straight from Supabase).

### One-time setup (do these in order)

1. **Run the schema.** Open your Supabase project → SQL Editor → New query,
   paste in the full contents of `supabase/schema.sql` from this repo, and
   run it. This creates the `vehicles`, `pending_vehicles`, `app_admins` and
   `synced_instagram_posts` tables, sets up Row Level Security so the public
   can only ever read `active` cars, creates the `vehicle-photos` storage
   bucket, and seeds your existing 6 listings.

2. **Create your admin login.** Supabase dashboard → Authentication → Users →
   Add user. Give it your own email and a password — this is what you'll sign
   into `/admin` with. Copy the user's UID (shown in the users list).

3. **Authorize that login as an admin.** Back in the SQL Editor, run:
   ```sql
   insert into public.app_admins (user_id) values ('paste-the-uid-here');
   ```
   Without this row, that login can sign in but every read/write will be
   refused by Row Level Security — being a valid Supabase user is not enough
   on its own, only rows listed in `app_admins` can manage inventory.

4. **Turn off public sign-ups.** Authentication → Sign In / Providers →
   disable "Allow new users to sign up". This is a static site with a public
   anon key baked into the page source (by design, that key is meant to be
   public) — without this, anyone could create an account, though they'd
   still be blocked from writing anything by step 3's allowlist. Belt and
   braces.

5. **Get your API credentials.** Settings → API in the Supabase dashboard:
   - **Project URL**
   - **anon public key**
   - **service_role key** (marked secret — never put this one in the site's
     source code)

   Send me the Project URL and anon key and I'll wire them into
   `supabase-config.js`. Add the service_role key yourself directly in
   Vercel (next step) rather than pasting it in chat.

6. **Vercel environment variables** (Project → Settings → Environment
   Variables):

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | same Project URL as above |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key — keep this one secret |
   | `IG_USER_ID` | your Instagram Business account's numeric ID (for auto-sync — see below) |
   | `IG_ACCESS_TOKEN` | long-lived Instagram Graph API token (see below) |
   | `CRON_SECRET` | any random string; Vercel sends it automatically to authenticate the daily cron run |

   If `GH_TOKEN`, `GH_REPO`, `GH_BRANCH` or `ADMIN_KEY` are still set from an
   earlier version of this site, they're no longer used and can be deleted.

7. **Redeploy** so the new environment variables take effect.

### Using the dashboard

Go to `yoursite.vercel.app/admin` on your phone or laptop, sign in with the
login from step 2.

- **Inventory tab** — every car, active or sold. Edit opens the full form
  in place (price, year, condition, photos — add or remove images right
  there). Mark sold / Mark active toggles whether it shows on the public
  site. Delete removes it and its photos for good.
- **Add listing tab** — blank form + photo upload for a brand new car.
- **Instagram queue tab** — posts pulled from @metrocardeals waiting for
  your review (see below). Approve publishes it to the live site exactly as
  edited in that form; Reject discards it.

A car marked **sold** disappears from the public site (Row Level Security
only ever serves `status = 'active'` rows to visitors) rather than showing a
"sold" badge — tell me if you'd rather keep sold cars visible with a badge
instead, it's a small change.

## Instagram auto-sync

Once a day, a Vercel Cron job checks @metrocardeals for new posts, downloads
the photos into Supabase Storage, and stages the listing in the Instagram
queue tab above — nothing goes live until you approve it there.

### Setup

1. **Instagram** must be a Business or Creator account linked to a Facebook
   Page.
2. **Meta developer app**: create one at developers.facebook.com, add the
   "Instagram Graph API" product, add your own account as a tester (no app
   review needed for your own account), and generate a long-lived access
   token plus your Instagram user ID — these are the `IG_ACCESS_TOKEN` and
   `IG_USER_ID` values in the Vercel env var table above.

The parser is a rough guess (regex against the caption text), not magic — it
will sometimes get the price, year or model wrong, especially on captions
that don't follow a "Make Model Year, ₦Price, condition" pattern. That's
exactly why nothing publishes without you looking at it first in the queue.

### Limits

- Runs once a day (Vercel Hobby plan caps cron jobs at daily). Upgrading to
  Pro allows hourly or faster.
- Only image posts and carousels are picked up; Reels/videos are skipped for
  now.
