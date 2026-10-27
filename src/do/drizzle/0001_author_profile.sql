-- My past replies, written under random aliases, move to the reserved author alias.
-- The alias guards make each statement a no-op if an id ever points at another comment.
UPDATE `replies` SET `alias` = 'Wyndham', `updated_at` = datetime('now')
WHERE `id` IN (5, 10, 11, 12, 14, 18, 20, 30, 42)
  AND `alias` IN ('Boss Boxer', 'Enquirer Variably', 'Fluid Hobby', 'Leafy Outer');
--> statement-breakpoint
UPDATE `replies` SET `deleted_at` = datetime('now'), `updated_at` = datetime('now')
WHERE `id` IN (1, 2, 40)
  AND `alias` IN ('Boss Boxer', 'Promptly Padded', 'Corn Easel');
