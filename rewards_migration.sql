-- HANDALA Rewards Table
-- Run this in Supabase SQL Editor for project audvtdbylhmumvdrhijk

-- Rewards table
CREATE TABLE IF NOT EXISTS public.rewards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('verification','upload','rose','prayer')),
  points integer NOT NULL DEFAULT 0,
  wallet_address text,
  claimed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Users can insert their own rewards
CREATE POLICY "Users can insert own rewards" ON public.rewards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own rewards
CREATE POLICY "Users can read own rewards" ON public.rewards
  FOR SELECT USING (auth.uid() = user_id);

-- Prevent duplicate verification reward (one per user)
CREATE UNIQUE INDEX IF NOT EXISTS rewards_verification_unique
  ON public.rewards (user_id, action_type)
  WHERE action_type = 'verification';
