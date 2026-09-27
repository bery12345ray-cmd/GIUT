CREATE TABLE profiles (id text PRIMARY KEY, nickname text NOT NULL, bio text NOT NULL DEFAULT '', created_at text NOT NULL);
CREATE TABLE spots (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES profiles(id), title text NOT NULL,
 body text NOT NULL, category text NOT NULL, lat double precision NOT NULL, lng double precision NOT NULL,
 location text NOT NULL, image text, ar integer NOT NULL DEFAULT 0, route text NOT NULL DEFAULT '[]',
 example integer NOT NULL DEFAULT 0, created_at text NOT NULL
);
CREATE INDEX idx_spots_user ON spots(user_id);
CREATE INDEX idx_spots_location ON spots(lat,lng);
CREATE TABLE comments (id text PRIMARY KEY, spot_id text NOT NULL REFERENCES spots(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES profiles(id), body text NOT NULL, created_at text NOT NULL);
CREATE INDEX idx_comments_spot ON comments(spot_id);
CREATE TABLE credits (id text PRIMARY KEY, user_id text NOT NULL REFERENCES profiles(id), amount integer NOT NULL, reason text NOT NULL, created_at text NOT NULL);
CREATE INDEX idx_credits_user_time ON credits(user_id,created_at);
CREATE TABLE crowd (spot_id text NOT NULL REFERENCES spots(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES profiles(id), rating integer NOT NULL, created_at text NOT NULL, PRIMARY KEY(user_id,spot_id));
CREATE INDEX idx_crowd_spot ON crowd(spot_id);
CREATE TABLE reactions (spot_id text NOT NULL REFERENCES spots(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES profiles(id), kind text NOT NULL, created_at text NOT NULL, PRIMARY KEY(user_id,spot_id,kind));
CREATE INDEX idx_reactions_spot_kind ON reactions(spot_id,kind);
CREATE TABLE reports (id text PRIMARY KEY, spot_id text NOT NULL REFERENCES spots(id) ON DELETE CASCADE, user_id text NOT NULL REFERENCES profiles(id), reason text NOT NULL, created_at text NOT NULL);
CREATE TABLE uploads (id text PRIMARY KEY, user_id text NOT NULL REFERENCES profiles(id), content_type text NOT NULL, created_at text NOT NULL);
CREATE TABLE scrap_folders (id text PRIMARY KEY, user_id text NOT NULL REFERENCES profiles(id), name text NOT NULL, is_default integer NOT NULL DEFAULT 0, created_at text NOT NULL, updated_at text NOT NULL);
CREATE INDEX idx_scrap_folders_user ON scrap_folders(user_id);
CREATE TABLE folder_spots (folder_id text NOT NULL REFERENCES scrap_folders(id) ON DELETE CASCADE, spot_id text NOT NULL REFERENCES spots(id) ON DELETE CASCADE, position integer NOT NULL, created_at text NOT NULL, PRIMARY KEY(folder_id,spot_id));
CREATE INDEX idx_folder_spots_order ON folder_spots(folder_id,position);
CREATE TABLE courses (id text PRIMARY KEY, user_id text NOT NULL REFERENCES profiles(id), title text NOT NULL, description text NOT NULL DEFAULT '', mode text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL);
CREATE INDEX idx_courses_user ON courses(user_id);
CREATE TABLE course_stops (course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE, spot_id text NOT NULL REFERENCES spots(id) ON DELETE CASCADE, position integer NOT NULL, PRIMARY KEY(course_id,spot_id));
CREATE INDEX idx_course_stops_order ON course_stops(course_id,position);
