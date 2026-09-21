-- ============================================================
-- TDS/TCS Register — Supabase Database Setup
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Parties Table (Input 01)
CREATE TABLE IF NOT EXISTS parties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  pan_no TEXT NOT NULL,
  name_as_per_pan TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique PAN per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_user_pan ON parties(user_id, pan_no);

-- 2. Transactions Table (Input 02 + Input 03)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  pan_no TEXT NOT NULL,
  name_as_per_pan TEXT NOT NULL,
  payment_date DATE NOT NULL,
  bill_no TEXT NOT NULL,
  work_category TEXT NOT NULL,
  taxable_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  tds_category TEXT NOT NULL,
  tds_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tds_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  for_payment BOOLEAN DEFAULT FALSE,
  challan_no TEXT,
  challan_date DATE,
  challan_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Categories Table (Settings)
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('work', 'tdsCategory', 'tdsPercent')),
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique value per user and type
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_type_value ON categories(user_id, type, value);

-- 4. Row Level Security (RLS) — users can only see their own data
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies if they exist (makes the script re-runnable/idempotent)
DROP POLICY IF EXISTS "Users can view own parties" ON parties;
DROP POLICY IF EXISTS "Users can insert own parties" ON parties;
DROP POLICY IF EXISTS "Users can update own parties" ON parties;
DROP POLICY IF EXISTS "Users can delete own parties" ON parties;

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

DROP POLICY IF EXISTS "Users can view own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
DROP POLICY IF EXISTS "Users can update own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON categories;

-- Parties policies
CREATE POLICY "Users can view own parties" ON parties
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own parties" ON parties
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own parties" ON parties
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own parties" ON parties
  FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Categories policies
CREATE POLICY "Users can view own categories" ON categories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON categories
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Storage bucket for challan PDFs
-- Create the public 'challans' bucket if not already present
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'challans',
  'challans',
  true,
  10485760, -- 10MB file limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf'];

-- Clean up existing storage policies if they exist (makes the script re-runnable/idempotent)
DROP POLICY IF EXISTS "Authenticated users can upload challans" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for challans" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own challans" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own challans" ON storage.objects;

-- Allow authenticated users to upload challan PDFs to the 'challans' bucket
CREATE POLICY "Authenticated users can upload challans"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'challans');

-- Allow public read access to view/download challans
CREATE POLICY "Public read access for challans"
ON storage.objects FOR SELECT
USING (bucket_id = 'challans');

-- Allow authenticated users to update files in 'challans'
CREATE POLICY "Users can update own challans"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'challans');

-- Allow authenticated users to delete files in 'challans'
CREATE POLICY "Users can delete own challans"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'challans');

