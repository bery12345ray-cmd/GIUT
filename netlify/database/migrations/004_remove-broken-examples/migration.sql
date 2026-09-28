-- Remove the retired sample records whose bundled images no longer render.
-- Related comments, reactions, saves, course stops and discoveries cascade.
DELETE FROM spots
WHERE id IN ('example-forest', 'example-lake', 'example-river')
   OR example = 1;
