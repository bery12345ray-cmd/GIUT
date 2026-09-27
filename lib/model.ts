export type Point = { lat: number; lng: number };
export type Spot = Point & { id:string; userId:string; title:string; body:string; category:string; location:string; image:string|null; ar:number; route:Point[]; example:number; createdAt:string; nickname:string; likes:number; saves:number; comments:number; liked:number; saved:number; placeId?:string; discoveries?:number; discovered?:number|boolean };
export type AvatarSkin = 'wave'|'explore'|'love'|'social';
export type Profile = {id:string;nickname:string;bio:string;avatarUrl:string|null;avatarSkin:AvatarSkin;balance:number;postCount:number;arCount:number;savedCount:number;receivedLikes:number};
export type Ledger = {id:string;amount:number;reason:string;createdAt:string};
export type Bootstrap = {spots:Spot[];user:Profile|null;ledger:Ledger[];kakaoKey:string;signInPath:string};
export const CATEGORIES = ['전체','사진 스팟','산책','러닝','카페','맛집','AR 기록'] as const;
export const DEFAULT_CENTER:Point = {lat:37.5446,lng:127.0438};
export const PHOTO_CREDITS = [
 {file:'/photos/forest.jpg',name:'Seoulforest path01',author:'Enigma7seven',license:'CC BY-SA 3.0',url:'https://commons.wikimedia.org/wiki/File:Seoulforest_path01.jpg',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/'},
 {file:'/photos/lake.jpg',name:'Seoulforest lake02',author:'Enigma7seven',license:'CC BY-SA 3.0',url:'https://commons.wikimedia.org/wiki/File:Seoulforest_lake02.jpg',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/'},
 {file:'/photos/river.jpg',name:'Night view at Ttukseom Hangang Park',author:'Real rism',license:'CC BY-SA 4.0',url:'https://commons.wikimedia.org/wiki/File:NIght_view_at_Ttukseom_Hangang_Park.jpg',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'}
];
const base = {userId:'spotmap-guide',nickname:'골목대장 기웃이',example:1,createdAt:'2026-09-07T00:00:00.000Z',likes:0,saves:0,comments:0,liked:0,saved:0,route:[]};
export const EXAMPLES:Spot[] = [
 {...base,id:'example-forest',title:'나무 냄새를 따라 기웃',body:'기웃이가 먼저 찾아낸 나무 사이 산책길이에요. 빛이 부드러운 시간에 천천히 걸어보세요.\n\n이 기록은 사용 방법을 보여주는 예시입니다. 사진은 2009년에 촬영되어 현재 모습과 다를 수 있어요. 핀은 장소의 대략적인 위치를 나타냅니다.',category:'산책',lat:37.5445,lng:127.0375,location:'서울 성동구 · 서울숲',image:'/photos/forest.jpg',ar:1},
 {...base,id:'example-lake',title:'물빛이 잠깐 머문 자리',body:'사람들이 지나친 호숫가에서 기웃이가 발견한 장면이에요. 방문한 시간과 그날의 분위기를 함께 남겨주세요.\n\n2009년 자료 사진을 사용한 예시 기록으로, 현재 상태를 나타내지 않습니다.',category:'사진 스팟',lat:37.5466,lng:127.0389,location:'서울 성동구 · 서울숲 호수',image:'/photos/lake.jpg',ar:0},
 {...base,id:'example-river',title:'밤바람 따라 달리는 영역',body:'강바람을 따라 달리는 길도 길냥이들의 영역이에요. 마음에 든 코스와 쉬어가기 좋은 자리를 지도에 그려보세요.\n\n2024년 자료 사진을 사용한 예시 기록입니다. 핀은 공원의 대략적인 위치입니다.',category:'러닝',lat:37.5293,lng:127.0674,location:'서울 광진구 · 뚝섬한강공원',image:'/photos/river.jpg',ar:1},
];
export function distance(a:Point,b:Point){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlng=(b.lng-a.lng)*r;const v=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(v),Math.sqrt(1-v));}
export function bearing(a:Point,b:Point){const r=Math.PI/180,d=(b.lng-a.lng)*r;return (Math.atan2(Math.sin(d)*Math.cos(b.lat*r),Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos(d))/r+360)%360;}
export function formatDistance(m:number){return m<1000?`${Math.round(m)}m`:`${(m/1000).toFixed(1)}km`;}
export function routeDistance(points:Point[]){return points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);}
