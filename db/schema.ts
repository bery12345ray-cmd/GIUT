import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const profiles = sqliteTable('profiles', { id: text('id').primaryKey(), nickname: text('nickname').notNull(), bio: text('bio').notNull().default(''), createdAt: text('created_at').notNull() });
export const spots = sqliteTable('spots', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => profiles.id), title: text('title').notNull(), body: text('body').notNull(), category: text('category').notNull(),
  lat: real('lat').notNull(), lng: real('lng').notNull(), location: text('location').notNull(), image: text('image'), ar: integer('ar').notNull().default(0), route: text('route').notNull().default('[]'), example: integer('example').notNull().default(0), createdAt: text('created_at').notNull(),
}, t => [index('idx_spots_user').on(t.userId), index('idx_spots_location').on(t.lat, t.lng)]);
export const comments = sqliteTable('comments', {id:text('id').primaryKey(),spotId:text('spot_id').notNull().references(()=>spots.id,{onDelete:'cascade'}),userId:text('user_id').notNull().references(()=>profiles.id),body:text('body').notNull(),createdAt:text('created_at').notNull()},t=>[index('idx_comments_spot').on(t.spotId)]);
export const reactions = sqliteTable('reactions', {spotId:text('spot_id').notNull().references(()=>spots.id,{onDelete:'cascade'}),userId:text('user_id').notNull().references(()=>profiles.id),kind:text('kind').notNull(),createdAt:text('created_at').notNull()},t=>[primaryKey({columns:[t.userId,t.spotId,t.kind]}),index('idx_reactions_spot_kind').on(t.spotId,t.kind)]);
export const crowd = sqliteTable('crowd', {spotId:text('spot_id').notNull().references(()=>spots.id,{onDelete:'cascade'}),userId:text('user_id').notNull().references(()=>profiles.id),rating:integer('rating').notNull(),createdAt:text('created_at').notNull()},t=>[primaryKey({columns:[t.userId,t.spotId]}),index('idx_crowd_spot').on(t.spotId)]);
export const credits = sqliteTable('credits', {id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>profiles.id),amount:integer('amount').notNull(),reason:text('reason').notNull(),createdAt:text('created_at').notNull()},t=>[index('idx_credits_user_time').on(t.userId,t.createdAt)]);
export const uploads = sqliteTable('uploads', {id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>profiles.id),contentType:text('content_type').notNull(),createdAt:text('created_at').notNull()});
export const reports = sqliteTable('reports', {id:text('id').primaryKey(),spotId:text('spot_id').notNull().references(()=>spots.id,{onDelete:'cascade'}),userId:text('user_id').notNull().references(()=>profiles.id),reason:text('reason').notNull(),createdAt:text('created_at').notNull()});

export const scrapFolders = sqliteTable('scrap_folders', {
  id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>profiles.id),name:text('name').notNull(),isDefault:integer('is_default').notNull().default(0),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
}, t=>[index('idx_scrap_folders_user').on(t.userId)]);
export const folderSpots = sqliteTable('folder_spots', {
  folderId:text('folder_id').notNull().references(()=>scrapFolders.id,{onDelete:'cascade'}),spotId:text('spot_id').notNull().references(()=>spots.id,{onDelete:'cascade'}),position:integer('position').notNull(),createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.folderId,t.spotId]}),index('idx_folder_spots_order').on(t.folderId,t.position)]);
export const courses = sqliteTable('courses', {
  id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>profiles.id),title:text('title').notNull(),description:text('description').notNull().default(''),mode:text('mode').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[index('idx_courses_user').on(t.userId)]);
export const courseStops = sqliteTable('course_stops', {
  courseId:text('course_id').notNull().references(()=>courses.id,{onDelete:'cascade'}),spotId:text('spot_id').notNull().references(()=>spots.id,{onDelete:'cascade'}),position:integer('position').notNull(),
},t=>[primaryKey({columns:[t.courseId,t.spotId]}),index('idx_course_stops_order').on(t.courseId,t.position)]);
