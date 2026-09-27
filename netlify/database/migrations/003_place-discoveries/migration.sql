-- Keep existing records intact. A shared place_id only groups records explicitly
-- added through "이 장소에 이어 남기기"; proximity alone never merges places.
ALTER TABLE spots ADD COLUMN place_id text;
CREATE INDEX idx_spots_place ON spots ((COALESCE(place_id, id)), created_at);

CREATE TABLE discoveries (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES profiles(id),
 spot_id text NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
 created_at text NOT NULL,
 read_at text,
 UNIQUE(user_id, spot_id)
);
CREATE INDEX idx_discoveries_spot ON discoveries(spot_id, created_at);
-- Location is checked in memory. Coordinates, accuracy and movement are not stored.
