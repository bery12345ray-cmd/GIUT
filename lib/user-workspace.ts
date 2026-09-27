import type {DataStore} from './data-store';
import type {Profile, Spot, Ledger} from './model';
import type {Course} from './collections';

export type UserWorkspace = {
  user: Profile; mySpots: Spot[]; myCourses: Course[];
  likedSpots: Spot[]; savedSpots: Spot[];
  interactions: {likedSpotIds: string[]; savedSpotIds: string[]};
  ledger: Ledger[];
};

export function readUserProfile(db: DataStore, userId: string) {
  return db.prepare(`SELECT p.id,p.nickname,p.bio,p.avatar_url AS avatarUrl,p.avatar_skin AS avatarSkin,
    (SELECT COALESCE(SUM(amount),0) FROM credits WHERE user_id=p.id) AS balance,
    (SELECT COUNT(*) FROM spots WHERE user_id=p.id) AS postCount,
    (SELECT COUNT(*) FROM spots WHERE user_id=p.id AND ar=1) AS arCount,
    (SELECT COUNT(*) FROM reactions WHERE user_id=p.id AND kind='save') AS savedCount,
    (SELECT COUNT(*) FROM reactions r JOIN spots s ON s.id=r.spot_id WHERE s.user_id=p.id AND r.kind='like') AS receivedLikes
    FROM profiles p WHERE p.id=?`).bind(userId).first<Profile>();
}

/** userId must come from the verified server session, not a request parameter. */
export async function readUserWorkspace(db: DataStore, userId: string): Promise<UserWorkspace | null> {
  const user = await readUserProfile(db, userId);
  if (!user) return null;
  const [places, courses, stops, reactions, ledger] = await Promise.all([
    db.prepare(`SELECT s.id,s.user_id AS userId,s.title,s.body,s.category,s.lat,s.lng,s.location,s.image,s.ar,s.route,s.example,s.created_at AS createdAt,p.nickname,COALESCE(s.place_id,s.id) AS placeId,
      (SELECT COUNT(*) FROM discoveries v WHERE v.spot_id=s.id) AS discoveries,
      EXISTS(SELECT 1 FROM discoveries v WHERE v.spot_id=s.id AND v.user_id=?) AS discovered,
      (SELECT COUNT(*) FROM reactions r WHERE r.spot_id=s.id AND r.kind='like') AS likes,
      (SELECT COUNT(*) FROM reactions r WHERE r.spot_id=s.id AND r.kind='save') AS saves,
      (SELECT COUNT(*) FROM comments c WHERE c.spot_id=s.id) AS comments,
      EXISTS(SELECT 1 FROM reactions r WHERE r.spot_id=s.id AND r.kind='like' AND r.user_id=?) AS liked,
      EXISTS(SELECT 1 FROM reactions r WHERE r.spot_id=s.id AND r.kind='save' AND r.user_id=?) AS saved

      FROM spots s JOIN profiles p ON p.id=s.user_id
      WHERE s.user_id=? OR EXISTS(SELECT 1 FROM reactions r WHERE r.spot_id=s.id AND r.user_id=?)
      ORDER BY s.created_at DESC`).bind(userId,userId,userId,userId,userId).all<Omit<Spot, 'route'> & {route: string}>(),
    db.prepare(`SELECT c.id,c.user_id AS userId,c.title,c.description,c.mode,c.created_at AS createdAt,c.updated_at AS updatedAt,p.nickname
      FROM courses c JOIN profiles p ON p.id=c.user_id WHERE c.user_id=? ORDER BY c.created_at DESC`)
      .bind(userId).all<Omit<Course, 'spotIds'>>(),
    db.prepare('SELECT s.course_id,s.spot_id FROM course_stops s JOIN courses c ON c.id=s.course_id WHERE c.user_id=? ORDER BY s.position')
      .bind(userId).all<{course_id: string; spot_id: string}>(),
    db.prepare('SELECT spot_id,kind FROM reactions WHERE user_id=?').bind(userId).all<{spot_id: string; kind: string}>(),
    db.prepare('SELECT id,amount,reason,created_at AS createdAt FROM credits WHERE user_id=? ORDER BY created_at DESC LIMIT 100')
      .bind(userId).all<Ledger>(),
  ]);
  const spots: Spot[] = places.results.map(s => ({...s, route: JSON.parse(s.route || '[]')}));
  return {
    user,
    mySpots: spots.filter(s => s.userId === userId),
    myCourses: courses.results.map(c => ({...c, spotIds: stops.results.filter(s => s.course_id === c.id).map(s => s.spot_id)})),
    likedSpots: spots.filter(s => s.liked), savedSpots: spots.filter(s => s.saved),
    interactions: {
      likedSpotIds: reactions.results.filter(r => r.kind === 'like').map(r => r.spot_id),
      savedSpotIds: reactions.results.filter(r => r.kind === 'save').map(r => r.spot_id),
    },
    ledger: ledger.results,
  };
}
