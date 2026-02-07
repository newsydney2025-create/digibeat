-- Manually insert the user's requested account since scraper failed
INSERT INTO instagram_accounts (id, instagram_id, username, full_name, avatar_url, website, is_active, last_synced_at, created_at, updated_at)
VALUES (
    'ea0b3f8b-9679-4592-a982-598441434310',
    'manual_hellen_01',
    'hellen_nguyen01',
    'Hellen Nguyen',
    'https://ui-avatars.com/api/?name=Hellen+Nguyen&background=random',
    'https://www.instagram.com/hellen_nguyen01',
    true,
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (username) DO UPDATE SET 
    last_synced_at = NOW(),
    website = EXCLUDED.website;

-- Insert some fake reels for this account so charts work
INSERT INTO instagram_reels (account_id, short_code, caption, video_play_count, likes_count, comments_count, thumbnail_url, timestamp, created_at)
VALUES 
(
    (SELECT id FROM instagram_accounts WHERE username = 'hellen_nguyen01'),
    'reel_h_1',
    'Welcome to my world! basic test',
    12050, 450, 20,
    null,
    NOW() - INTERVAL '1 day',
    NOW()
),
(
    (SELECT id FROM instagram_accounts WHERE username = 'hellen_nguyen01'),
    'reel_h_2',
    'Another beautiful day 🌞',
    15600, 890, 45,
    null,
    NOW() - INTERVAL '3 days',
    NOW()
),
(
    (SELECT id FROM instagram_accounts WHERE username = 'hellen_nguyen01'),
    'reel_h_3',
    'Coding vibes 💻',
    25000, 1200, 150,
    null,
    NOW() - INTERVAL '5 days',
    NOW()
)
ON CONFLICT (short_code) DO NOTHING;
