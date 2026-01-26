# OOTP Stats Tracker

A web application for tracking Out of the Park Baseball tournament statistics.

## Setup Instructions

### Step 1: Set Up Supabase Database

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New query**
4. Paste this SQL and click **Run**:

```sql
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  batting JSONB DEFAULT '[]'::jsonb,
  pitching JSONB DEFAULT '[]'::jsonb
);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (you can restrict later)
CREATE POLICY "Allow all operations" ON tournaments FOR ALL USING (true);
```

5. You should see "Success" message

### Step 2: Get Your Supabase Credentials

1. In Supabase, go to **Settings** (gear icon) → **API**
2. Copy your **Project URL** (looks like `https://xxxxx.supabase.co`)
3. Copy your **anon public** key (under "Project API keys")

### Step 3: Deploy to Vercel

1. Go to [github.com](https://github.com) and create a new repository
2. Name it `ootp-stats-tracker` (or whatever you like)
3. Upload all these files to your repository
4. Go to [vercel.com](https://vercel.com) and sign in with GitHub
5. Click **Add New** → **Project**
6. Select your `ootp-stats-tracker` repository
7. Before clicking Deploy, expand **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
8. Click **Deploy**

### Step 4: Done!

Your app will be live at `https://your-project-name.vercel.app`

## Local Development (Optional)

If you want to run locally:

1. Create a `.env` file with:
```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

2. Run:
```bash
npm install
npm run dev
```

## CSV Formats

### Pitching CSV
```
POS,#,Name,T,G,GS,WIN%,SV%,IP,BF,ERA,AVG,OBP,BABIP,WHIP,BRA/9,HR/9,BB/9,K/9,LOB%,ERA+,FIP,FIP-,WAR,SIERA
```

### Batting CSV
```
POS,#,Name,Inf,B,T,G,GS,PA,AB,H,2B,3B,HR,RBI,R,BB,IBB,HP,SO,GIDP,AVG,OBP,SLG,ISO,OPS,OPS+,BABIP,WAR,SB,CS
```
