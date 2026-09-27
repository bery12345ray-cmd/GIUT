import {auth} from '@/lib/auth';
import {socialAuthSettings} from '@/lib/auth-settings';
import { database, bucket } from '@/lib/netlify-platform';
import { EXAMPLES } from '@/lib/model';
import { isSameOriginRequest } from '@/lib/request-origin';

export function bindings(){return {DB:database,BUCKET:bucket,KAKAO_JAVASCRIPT_KEY:process.env.KAKAO_JAVASCRIPT_KEY,KAKAO_REST_API_KEY:process.env.KAKAO_REST_API_KEY};}
export function db(){const b=bindings().DB;if(!b)throw new Error('기록 저장소에 연결할 수 없어요. 잠시 후 다시 시도해주세요.');return b;}
export class HttpError extends Error{constructor(public status:number,message:string){super(message);}}
export async function identity(required=false){const u=socialAuthSettings().secret?(await auth())?.user:null;if(!u?.id){if(required)throw new HttpError(401,'로그인 후 이용할 수 있어요.');return null;}return {id:u.id,nickname:u.name||'새로운 탐험가'};}
export async function ensureProfile(u:{id:string;nickname:string}){await db().prepare('INSERT OR IGNORE INTO profiles(id,nickname,bio,created_at) VALUES(?,?,?,?)').bind(u.id,u.nickname,'',new Date().toISOString()).run();}
export async function ensureExamples(){const d=db();if(await d.prepare('SELECT id FROM profiles WHERE id=?').bind('spotmap-guide').first())return;await d.batch([
 d.prepare('INSERT OR IGNORE INTO profiles(id,nickname,bio,created_at) VALUES(?,?,?,?)').bind('spotmap-guide','Spotmap 가이드','처음 둘러보는 분들을 위한 예시 스팟',new Date().toISOString()),
 ...EXAMPLES.map(s=>d.prepare('INSERT OR IGNORE INTO spots(id,user_id,title,body,category,lat,lng,location,image,ar,route,example,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(s.id,s.userId,s.title,s.body,s.category,s.lat,s.lng,s.location,s.image,s.ar,'[]',1,s.createdAt))
]);}
export function checkOrigin(req:Request){if(!isSameOriginRequest(req,process.env.GIUT_ALLOWED_ORIGINS))throw new HttpError(403,'다른 사이트에서 보낸 요청은 처리할 수 없어요.');}
export function respondError(e:unknown){if(e instanceof HttpError)return Response.json({error:e.message},{status:e.status});console.error('Spotmap request failed',e instanceof Error?e.message:'unknown error');return Response.json({error:'연결이 잠시 원활하지 않아요. 입력한 내용을 유지하고 다시 시도해주세요.'},{status:503});}
