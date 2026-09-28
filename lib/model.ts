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
export const EXAMPLES:Spot[] = [];
export function distance(a:Point,b:Point){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlng=(b.lng-a.lng)*r;const v=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(v),Math.sqrt(1-v));}
export function bearing(a:Point,b:Point){const r=Math.PI/180,d=(b.lng-a.lng)*r;return (Math.atan2(Math.sin(d)*Math.cos(b.lat*r),Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos(d))/r+360)%360;}
export function formatDistance(m:number){return m<1000?`${Math.round(m)}m`:`${(m/1000).toFixed(1)}km`;}
export function routeDistance(points:Point[]){return points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);}
