# Cyberior Payment Tracker — Setup Guide

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project" → name it "cyberior-payment-tracker"
3. Choose a region close to your users (Frankfurt EU works well for Iraq/Gulf)
4. Set a strong database password — save it somewhere safe
5. Wait for project to be ready (~2 minutes)

## Step 2: Run the Database Schema

1. In your Supabase project, click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open the file `supabase/migrations/001_schema.sql` from this project
4. Paste all contents into the editor and click **Run**
5. You should see "Success. No rows returned"

## Step 3: Seed Product Data

1. In SQL Editor, click **New Query**
2. Open `supabase/seed.sql` from this project
3. Paste and run it to pre-load all Cyberior programs

## Step 4: Create Supabase Storage Bucket

1. In your Supabase project, go to **Storage** (left sidebar)
2. Click **New Bucket**
3. Name it: `payment-proofs`
4. Set it to **Public** (so proof images can be viewed by the team)
5. Click Create

## Step 5: Get Your API Keys

1. Go to **Settings → API** in your Supabase project
2. Copy:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ…`)

## Step 6: Configure the App

1. In this project folder, copy `.env.example` → create new file `.env`
2. Fill in:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...your-anon-key...
```

## Step 7: Install & Run

```bash
cd "Cyberior Payment Tracker"
npm install
npm run dev
```

App will open at http://localhost:5173

## Step 8: Create Admin Account (Marwa)

1. In Supabase → **Authentication → Users** → **Add User**
2. Set email: `marwa.abdulkareem95@gmail.com` (or any you prefer)
3. Set a password
4. Go to **SQL Editor** and run:
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@here.com');
```

## Step 9: Add Sales Agents (Huda, Hawraa)

**Option A — Invite as users (they can log in):**
1. Settings page → "Add User" → fill name, email, role = "Sales Agent"
2. Or in Supabase Auth → Add User manually

**Option B — Add as reference only (no login):**
1. Go to Agents page → Add Agent → fill name/phone/email (no login created)
   Note: They won't be able to log in but their deals will still be tracked.

## Step 10: Link Agent Profiles to Login Accounts

After creating both the Supabase Auth user AND the sales_agents record:
```sql
UPDATE public.sales_agents
SET profile_id = (SELECT id FROM auth.users WHERE email = 'huda@email.com')
WHERE name = 'Huda';
```
This enables RLS — agents will only see their own customers.

---

## Roles Summary

| Role | Can Do |
|------|--------|
| **Admin (Marwa)** | Everything: create, edit, delete, all reports, settings |
| **Agent (Huda/Hawraa)** | Own customers + deals + mark payments, can't delete |
| **Finance** | View all + mark payments, no delete, no price changes |

---

## Deploy to Production (Optional)

To host it online so your team can access from anywhere:

1. Push to GitHub
2. Go to https://vercel.com → Import project
3. Set environment variables (same as .env)
4. Click Deploy — free hosting, auto-updates on push

---

## Troubleshooting

**"Missing Supabase environment variables"** — Check your `.env` file exists and has correct values.

**"row-level security" errors** — Make sure you ran the SQL migration fully.

**Agents can see all customers** — Run Step 10 to link profile_id.

**Charts show no data** — Add some deals first, then refresh dashboard.
