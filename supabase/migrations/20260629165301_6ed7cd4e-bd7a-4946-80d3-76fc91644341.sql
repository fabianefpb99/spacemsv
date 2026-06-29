
-- Shift slides at position >= 2 forward, insert Chicken at position 2
UPDATE public.home_slides SET position = position + 1 WHERE position >= 2;
INSERT INTO public.home_slides (image_url, eyebrow, title, description, cta_label, cta_link, position, active)
VALUES ('/__l5e/assets-v1/1eb1377f-4b53-4978-879c-9540c42eb132/home-hero-chicken.webp',
        'ATRÉVETE EN', 'CHICKEN SPACE', E'Salta entre asteroides\ny multiplica tu apuesta.',
        'Jugar Chicken', '/chicken', 2, true);

-- Featured games: swap Dice (pos 3) and add Chicken at pos 3, Dice goes to pos 8
UPDATE public.home_featured_games SET position = 8 WHERE link = '/dados';
INSERT INTO public.home_featured_games (image_url, name, tag, tag_color, link, position, active)
VALUES ('/__l5e/assets-v1/0458a69d-ea85-4c3f-a5f0-91c9de421388/game-chicken.webp',
        'CHICKEN SPACE', 'NUEVO', 'emerald', '/chicken', 3, true);
