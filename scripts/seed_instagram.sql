
-- Instagram Accounts
INSERT INTO public.instagram_accounts (id, instagram_id, username, full_name, avatar_url, is_active, last_synced_at, created_at, updated_at) VALUES 
('c2d6bee7-6d9b-4c54-9052-5fc58b97e454', '77162192470', 'digiparksyd', 'Digipark Sydney', 'https://scontent.cdninstagram.com/v/t51.2885-19/548703590_17846031093568471_6200289270149935053_n.jpg', true, '2026-02-03 06:20:15.935+00', '2026-02-03 06:20:15.935+00', '2026-02-03 06:20:15.935+00'),
('4dfabdab-6ee0-498c-bbf4-bfbf0b975d0e', '3975246880', 'thebabybossgirl', 'Natasha - Mum to Anya & Alia', null, true, '2026-02-03 06:20:15.935+00', '2026-02-03 06:20:15.935+00', '2026-02-03 06:20:15.935+00');

-- Instagram Reels
INSERT INTO public.instagram_reels (id, account_id, short_code, caption, video_play_count, likes_count, comments_count, created_at, thumbnail_url, timestamp) VALUES 
('dc14473c-f864-49ee-94dd-656e8cb379ba', 'c2d6bee7-6d9b-4c54-9052-5fc58b97e454', 'DUP91cXEY-W', 'Digipark Sydney is such a fun mix of art, tech and imagination ✨', 747, 357, 25, '2026-02-03 06:21:41.287+00', 'https://picsum.photos/seed/DUP91cXEY-W/200/300', '2026-02-02 08:56:11+00'),
('e1a8552c-0f36-468a-9858-60776683444a', 'c2d6bee7-6d9b-4c54-9052-5fc58b97e454', 'ABC123456', 'Behind the scenes at Digipark 🎬', 5420, 1250, 89, '2026-02-03 06:21:41.287+00', 'https://picsum.photos/seed/ABC123456/200/300', '2026-02-01 10:30:00+00'),
('4617bdc6-aad2-4d2b-bb7d-dd2366ee7bbc', 'c2d6bee7-6d9b-4c54-9052-5fc58b97e454', 'DEF789012', 'The kids loved this interactive room! 🚀', 3210, 892, 45, '2026-02-03 06:21:41.287+00', 'https://picsum.photos/seed/DEF789012/200/300', '2026-01-30 14:20:00+00'),
('d3e10d68-3b66-4eef-b510-98b8d9aeb48d', 'c2d6bee7-6d9b-4c54-9052-5fc58b97e454', 'GHI345678', 'Digital art meets real life 🎨', 8900, 2100, 156, '2026-02-03 06:21:41.287+00', 'https://picsum.photos/seed/GHI345678/200/300', '2026-01-28 09:15:00+00'),
('ce959c29-548a-4258-8041-e6787abd8e0e', 'c2d6bee7-6d9b-4c54-9052-5fc58b97e454', 'BBB111111', 'Family funday! ❤️', 4500, 980, 60, '2026-02-03 06:21:42.433+00', 'https://picsum.photos/seed/BBB111111/200/300', '2026-02-01 11:00:00+00'),
('ac2e3907-d1c8-4b34-b181-146ce57c054e', '4dfabdab-6ee0-498c-bbf4-bfbf0b975d0e', 'CCC222222', 'The girls were obsessed with this room 💕', 7800, 2340, 145, '2026-02-03 06:21:42.433+00', 'https://picsum.photos/seed/CCC222222/200/300', '2026-01-29 14:30:00+00'),
('ae4f3182-84d3-4a5d-a56d-d0a5e25e9e86', '4dfabdab-6ee0-498c-bbf4-bfbf0b975d0e', 'DDD333333', 'Anya learning to dance with projections 💃', 3100, 890, 52, '2026-02-03 06:21:42.433+00', 'https://picsum.photos/seed/DDD333333/200/300', '2026-01-26 09:45:00+00'),
('bce039e7-8e18-45cb-992e-1cd73989f22e', '4dfabdab-6ee0-498c-bbf4-bfbf0b975d0e', 'EEE444444', 'Mum hack: tired kids = quiet car ride home 😴', 12500, 4200, 280, '2026-02-03 06:21:42.433+00', 'https://picsum.photos/seed/EEE444444/200/300', '2026-01-23 17:20:00+00'),
('028ba365-3144-4549-bfa6-fb288eec1aca', '4dfabdab-6ee0-498c-bbf4-bfbf0b975d0e', 'FFF555555', 'Best rainy day activity in Sydney ☔', 3800, 1120, 67, '2026-02-03 06:21:42.433+00', 'https://picsum.photos/seed/FFF555555/200/300', '2026-01-20 13:15:00+00');
