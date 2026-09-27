import {bearing, distance, type Spot} from '@/lib/model';
import {angleDelta, type LocationFix} from '@/lib/navigation';

export const AR_RADAR_RADIUS = 100;
export const AR_INTERACTION_RADIUS = 20;
export const AR_FIX_MAX_AGE = 12000;
type NearEvidence = {since:number; count:number};
export type ARDiscoveryState = {
  fix:LocationFix|null;
  lastAccepted:LocationFix|null;
  near:Record<string, NearEvidence>;
  reliable:boolean;
};
export const emptyARDiscovery = ():ARDiscoveryState => ({fix:null,lastAccepted:null,near:{},reliable:false});

export function radarFix(fix:LocationFix|null, now=Date.now()) {
  return !!fix && Number.isFinite(fix.lat) && Math.abs(fix.lat)<=90 &&
    Number.isFinite(fix.lng) && Math.abs(fix.lng)<=180 && Number.isFinite(fix.accuracy) &&
    fix.accuracy>=0 && fix.accuracy<=50 && Number.isFinite(fix.timestamp) &&
    now-fix.timestamp<=AR_FIX_MAX_AGE && now>=fix.timestamp-1000;
}

// A single GPS jump must not reveal a memory. Require two accurate fixes
// at least two seconds apart, both inside 20m; never enlarge that radius.
export function updateARDiscovery(previous:ARDiscoveryState, fix:LocationFix, spots:Spot[], now=Date.now()):ARDiscoveryState {
  if(!radarFix(fix,now)) return {...previous,fix,near:{},reliable:false};
  const last=previous.lastAccepted;
  if(last && fix.timestamp<=last.timestamp) return previous;
  const seconds=last ? (fix.timestamp-last.timestamp)/1000 : 0;
  if(last && seconds<=30 && distance(last,fix)>Math.max(45,seconds*7+Math.max(last.accuracy,fix.accuracy))) {
    return {...previous,fix,near:{},reliable:false};
  }
  const continuous=previous.reliable && !!last && seconds<=12;
  const near:Record<string,NearEvidence>={};
  if(fix.accuracy<=20) for(const spot of spots) {
    if(!spot.ar || distance(fix,spot)>AR_INTERACTION_RADIUS) continue;
    const old=continuous ? previous.near[spot.id] : undefined;
    near[spot.id]={since:old?.since ?? fix.timestamp,count:(old?.count ?? 0)+1};
  }
  return {fix,lastAccepted:fix,near,reliable:true};
}

export function discoverARSpots(state:ARDiscoveryState, spots:Spot[], heading:number|null, now=Date.now()) {
  const reliable=state.reliable && radarFix(state.fix,now);
  if(!reliable) return {reliable:false,nearby:[],interactive:[],visible:[]};
  const fix=state.fix!;
  const nearby=spots.filter(s=>s.ar).map(spot=>({spot,distance:distance(fix,spot),angle:heading===null?0:angleDelta(bearing(fix,spot),heading)}))
    .filter(s=>s.distance<=AR_RADAR_RADIUS).sort((a,b)=>a.distance-b.distance);
  const interactive=nearby.filter(s=>{
    const e=state.near[s.spot.id];
    return s.distance<=AR_INTERACTION_RADIUS && fix.accuracy<=20 && !!e && e.count>=2 && fix.timestamp-e.since>=2000;
  });
  // Bearing is undefined when standing directly on the stored coordinate.
  const visible=interactive.filter(s=>heading===null || s.distance<=3 || Math.abs(s.angle)<=48);
  return {reliable:true,nearby,interactive,visible};
}
