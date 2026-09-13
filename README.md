# MetroCarDeals Showroom

Static build for Vercel deployment.

## Instagram auto-sync

Once a day, a Vercel Cron job checks @metrocardeals for new posts, downloads the
photos, and stages the listing for review at `/admin` — nothing goes live until
you approve it there.

### One-time setup

1. **Instagram** must be a Business or Creator account linked to a Facebook Page.
2. **Meta developer app**: create one at developers.facebook.com, add the
   "Instagram Graph API" product, add your own account as a tester (no app
   review needed for your own account), and generate a long-lived access token
   plus your Instagram user ID.
3. **GitHub token**: a Personal Access Token with `repo` write access to this
   repository (Settings → Developer settings → Fine-grained tokens on GitHub).
4. In the Vercel project's Settings → Environment Variables, add:

   | Variable | Value |
   |---|---|
   | `IG_USER_ID` | your Instagram Business account's numeric ID |
   | `IG_ACCESS_TOKEN` | the long-lived Graph API token from step 2 |
   | `GH_TOKEN` | the GitHub token from step 3 |
   | `GH_REPO` | `metrocardealsng-svg/Metrocardeals-showroom` |
   | `GH_BRANCH` | whichever branch this Vercel project deploys from |
   | `ADMIN_KEY` | a password you make up, used to unlock `/admin` |
   | `CRON_SECRET` | any random string; Vercel sends it automatically to authenticate the daily cron run |

5. Redeploy so the new environment variables take effect.

### Using the review queue

Go to `yoursite.vercel.app/admin`, enter the `ADMIN_KEY` password. Each new
Instagram post shows its photos, a best-effort guess at make/model/year/price/
condition/colour, and the original caption. Fix anything wrong, then:

- **Approve & publish** — moves the photos out of staging and adds the car to
  the live site.
- **Reject** — discards the post; it won't be suggested again.

The parser is a rough guess (regex against the caption text), not magic — it
will sometimes get the price, year or model wrong, especially on captions that
don't follow a "Make Model Year, ₦Price, condition" pattern. That's exactly
why nothing publishes without a human looking at it first.

### Limits

- Runs once a day (Vercel Hobby plan caps cron jobs at daily). Upgrading to
  Pro allows hourly or faster.
- Only image posts and carousels are picked up; Reels/videos are skipped for now.
