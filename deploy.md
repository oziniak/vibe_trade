# Deploy Vibe Trade to Vercel

## Prerequisites

- GitHub account
- Vercel account (sign up at [vercel.com](https://vercel.com) — free tier works)
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

---

## Step 1: Push to GitHub

```bash
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USER/vibe-trade.git
git branch -M main
git push -u origin main
```

Make sure `.env.local` is in `.gitignore` — never push API keys.

---

## Step 2: Import project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select your `vibe-trade` repo
4. Vercel auto-detects Next.js — leave defaults as-is
5. Click **Deploy**

After this, every push to `main` auto-deploys to production. PR branches get preview URLs.

---

## Step 3: Add environment variables

Go to **Project Settings → Environment Variables** and add:

| Name                | Value        | Notes               |
| ------------------- | ------------ | ------------------- |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Your Claude API key |

Redeploy after adding (Vercel dashboard → Deployments → Redeploy, or just push a commit).

---

## Step 4: Set up rate limits (Upstash Redis)

Rate limiting protects your Claude API budget: **5 requests/min** and **10 requests/day** per IP.

1. Go to [console.upstash.com](https://console.upstash.com) and create a free account
2. Click **Create Database**
3. Name it (e.g. `vibe-trade`), pick a region close to your Vercel deployment (e.g. `us-east-1`)
4. On the database details page, scroll to the **REST API** section
5. Copy the **REST URL** and **REST Token**
6. In Vercel, go to **Project Settings → Environment Variables** and add:

| Name                       | Value                    |
| -------------------------- | ------------------------ |
| `UPSTASH_REDIS_REST_URL`   | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | `AXxx...`                |

7. Redeploy for the env vars to take effect (push a commit, or Deployments → Redeploy)

---

## How rate limits work

- **Without** Redis env vars → rate limiting is skipped, all requests pass through (local dev behavior)
- **With** Redis env vars → enforced automatically:
  - 5 requests per minute per IP
  - 10 requests per day per IP
- When a user hits the limit, the UI shows an amber cooldown banner with a live countdown
- Preset strategies (backtesting without AI) are never rate-limited
- Free Upstash tier (10k commands/day) is more than enough

---

## Summary of all env vars

| Variable                   | Required | Source                |
| -------------------------- | -------- | --------------------- |
| `ANTHROPIC_API_KEY`        | Yes      | console.anthropic.com |
| `UPSTASH_REDIS_REST_URL`   | No       | console.upstash.com   |
| `UPSTASH_REDIS_REST_TOKEN` | No       | console.upstash.com   |

<!-- add commit with email address -->
