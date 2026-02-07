-- Add hashtags column to instagram_reels table
ALTER TABLE instagram_reels ADD COLUMN IF NOT EXISTS hashtags TEXT[] DEFAULT '{}';
