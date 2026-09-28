'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {QueryClient,QueryClientProvider,useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {MapPin,Compass,ScanLine,Bookmark,UserRound,Plus,Search,SlidersHorizontal,LocateFixed,Minus,Heart,MessageCircle,ArrowUpRight,ArrowRight,ChevronDown,ChevronLeft,Check,Clock,Camera,ImagePlus,Footprints,Coffee,Utensils,CircleHelp,Bell,Wallet,Leaf,Flag,Trash2,Send,Settings2,Sparkles,Route,Navigation,LockKeyhole,Mountain,Medal,ExternalLink,LoaderCircle,X,CheckCircle2,LogIn} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Switch} from '@/components/ui/switch';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Button} from '@/components/ui/button';
import {Progress} from '@/components/ui/progress';
import {Toaster} from '@/components/ui/sonner';
import {toast} from 'sonner';
import MapCanvas,{type MapControl} from '@/components/map-canvas';
import ARView from '@/components/ar-view';
import ExplorePanel from '@/components/explore-panel';
import SpotShare from '@/components/spot-share';
import {sharedSpotId} from '@/lib/spot-share';
import {sharedCourseId} from '@/lib/course-share';
import CourseDetail from '@/components/course-detail';
import Giuti from '@/components/giuti';
import AuthPanel,{SignOutButton} from '@/components/social-auth';
import {SessionProvider,useSession} from 'next-auth/react';
import {useMyWorkspace} from '@/hooks/use-my-workspace';
import {AvatarPicker,ProfileAvatar} from '@/components/profile-avatar';
import type {AvatarSkin} from '@/lib/model';
import {useGiutMotion} from '@/components/giut-motion';
import Scrapbook,{SavePicker} from '@/components/scrapbook';
import FollowGuide,{type FollowTarget} from '@/components/follow-guide';
import {ExploreWelcome} from '@/components/explore-welcome';
import {DiscoveryButton,PlaceStories,ActivityList,useDiscoveryActivity,type PlaceStory} from '@/components/place-engagement';
import RecordComposer from '@/components/record-composer';
import {CATEGORIES,DEFAULT_CENTER,EXAMPLES,distance,formatDistance,routeDistance,type Bootstrap,type Point,type Profile,type Spot} from '@/lib/model';

const catIcons:Record<string,typeof Compass>={'전체':Compass,'사진 스팟':Camera,'산책':Leaf,'러닝':Footprints,'카페':Coffee,'맛집':Utensils,'AR 기록':ScanLine};
type Comment={id:string;body:string;createdAt:string;nickname:string;userId:string};
const empty:Bootstrap={spots:EXAMPLES,user:null,ledger:[],kakaoKey:'',signInPath:'/#login'};
async function request(url:string,init?:RequestInit){const r=await fetch(url,init);let body:any;try{body=await r.json();}catch{throw new Error('서버에 연결하지 못했어요. 다시 시도해주세요.');}if(!r.ok)throw new Error(body.error||'처리하지 못했어요. 다시 시도해주세요.');return body;}
function date(v:string){return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}).format(new Date(v));}
function Icon({category,size=16}:{category:string;size?:number}){const I=catIcons[category]||MapPin;return <I size={size}/>;}
function locate(){return new Promise<GeolocationPosition>((resolve,reject)=>{if(!navigator.geolocation){reject(new Error('위치 기능을 지원하지 않는 브라우저예요.'));return;}navigator.geolocation.getCurrentPosition(resolve,e=>reject(new Error(e.code===1?'브라우저에서 위치 권한을 허용해주세요.':'현재 위치를 찾지 못했어요. 잠시 후 다시 시도해주세요.')),{enableHighAccuracy:true,timeout:12000,maximumAge:30000});});}
function badges(user:Profile|null,spots:Spot[]){return [
 {id:'first',name:'첫 발도장',text:'첫 번째 골목 흔적 남기기',Icon:Footprints,earned:!!user&&user.postCount>=1,progress:Math.min(user?.postCount||0,1),target:1,color:'peach'},
 {id:'explorer',name:'골목 기웃대원',text:'골목 기록 3개 남기기',Icon:Compass,earned:!!user&&user.postCount>=3,progress:Math.min(user?.postCount||0,3),target:3,color:'green'},
 {id:'ar',name:'AR 수염 탐정',text:'첫 AR 흔적 남기기',Icon:ScanLine,earned:!!user&&user.arCount>=1,progress:Math.min(user?.arCount||0,1),target:1,color:'purple'},
 {id:'hot',name:'동네 대장',text:'한 흔적에 좋아요 10개',Icon:Sparkles,earned:spots.some(s=>s.userId===user?.id&&s.likes>=10),progress:Math.min(10,Math.max(0,...spots.filter(s=>s.userId===user?.id).map(s=>s.likes))),target:10,color:'yellow'},
 ];}

export default function Spotmap(){const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:true,staleTime:15000}}}));return <SessionProvider refetchOnWindowFocus refetchInterval={300}><QueryClientProvider client={client}><SessionApp/><Toaster position="top-center" theme="light" richColors/></QueryClientProvider></SessionProvider>;}

function SessionApp(){
 const {data:session,status}=useSession();const client=useQueryClient();const userId=session?.user?.id;
 useEffect(()=>{const filters={predicate:(q:{queryKey:readonly unknown[]})=>['spotmap','me','comments','collections','activity'].includes(String(q.queryKey[0]))&&q.queryKey[1]!== (userId||'guest')};void client.cancelQueries(filters).then(()=>client.removeQueries(filters));},[client,userId]);
 return <App key={userId||'guest'} userId={userId} sessionReady={status!=='loading'}/>;
}

function App({userId,sessionReady}:{userId?:string;sessionReady:boolean}){
 const designPreview=process.env.NODE_ENV==='development'&&typeof window!=='undefined'&&new URLSearchParams(window.location.search).has('designPreview');
 const [avatarSkin,setAvatarSkin]=useState<AvatarSkin>('wave');
 const [welcome,setWelcome]=useState(true),[locating,setLocating]=useState(false);
 const [area,setArea]=useState<{point:Point;label:string}|null>(null),[panelHidden,setPanelHidden]=useState(false);
 const [storySource,setStorySource]=useState<Spot|null>(null);
 const [sharedCourse,setSharedCourse]=useState<string|null>(null);
 const activity=useDiscoveryActivity(userId);
 const client=useQueryClient();const query=useQuery<Bootstrap>({queryKey:['spotmap',userId||'guest'],queryFn:({signal})=>request('/api/spotmap',{signal,cache:'no-store'}),enabled:sessionReady&&!designPreview,refetchInterval:designPreview?false:30000});
 const personal=useMyWorkspace();const workspace=userId&&personal.data?.user.id===userId?personal.data:null;
 const base=query.data||empty;const data:Bootstrap={...base,user:workspace?.user||(userId&&base.user?.id===userId?base.user:null),ledger:workspace?.ledger||(userId&&base.user?.id===userId?base.ledger:[]),spots:workspace?[...new Map([...base.spots,...workspace.mySpots,...workspace.savedSpots,...workspace.likedSpots].map(s=>[s.id,s])).values()]:base.spots};
 const [saveSpot,setSaveSpot]=useState<Spot|null>(null);const [follow,setFollow]=useState<FollowTarget|null>(null);
 const [tab,selectTab]=useState('map');
 const tabRef=useRef('map'),arTransitionTimer=useRef<number|null>(null);
 const [arEntering,setAREntering]=useState(false),[mapExiting,setMapExiting]=useState(false);
 useEffect(()=>()=>{if(arTransitionTimer.current!==null)window.clearTimeout(arTransitionTimer.current);},[]);
 useEffect(()=>{const navigate=(e:Event)=>{const next=(e as CustomEvent<string>).detail;if(['map','ar','saved','my'].includes(next)){setTab(next);setDrawing(false);}};window.addEventListener('giut:navigate',navigate);return()=>window.removeEventListener('giut:navigate',navigate);},[]);
 function setTab(value:string){
  const previous=tabRef.current;if(previous===value)return;
  if(arTransitionTimer.current!==null){window.clearTimeout(arTransitionTimer.current);arTransitionTimer.current=null;}
  const animate=value==='ar'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  tabRef.current=value;setAREntering(animate);setMapExiting(animate&&previous==='map');
  selectTab(value);
  if(animate)arTransitionTimer.current=window.setTimeout(()=>{setAREntering(false);setMapExiting(false);arTransitionTimer.current=null;},760);
 }
 const [category,setCategory]=useState('전체');const [search,setSearch]=useState('');const [sort,setSort]=useState('latest');const [selectedId,setSelectedId]=useState<string|null>(null);const [provider,setProvider]=useState('loading');
 const [dialog,setDialog]=useState<'login'|'wallet'|'profile'|'about'|'settings'|'report'|null>(null);const [notifications,setNotifications]=useState(false);const [compose,setCompose]=useState(false);const [composeKey,setComposeKey]=useState(0);const [draftPoint,setDraftPoint]=useState<Point>(DEFAULT_CENTER);const [draftAR,setDraftAR]=useState(false);const [draftRoute,setDraftRoute]=useState<Point[]>([]);const [drawing,setDrawing]=useState(false);const [gps,setGPS]=useState<Point|null>(null);const [expanded,setExpanded]=useState(false);const [placeResults,setPlaceResults]=useState<{name:string;address:string;lat:number;lng:number}[]>([]);const [searchBusy,setSearchBusy]=useState(false);const [comment,setComment]=useState('');const [report,setReport]=useState('');const [nickname,setNickname]=useState('');const [bio,setBio]=useState('');const [deleteTarget,setDeleteTarget]=useState<{spotId:string;commentId?:string}|null>(null);
 const appRoot=useRef<HTMLDivElement>(null);const map=useRef<MapControl|null>(null);const owned=workspace?.mySpots||data.spots.filter(s=>s.userId===data.user?.id);const saved=data.spots.filter(s=>s.saved);const achievements=badges(data.user,data.spots);
 const comments=useQuery<{spot:Spot;comments:Comment[];stories:PlaceStory[]}>({queryKey:['comments',userId||'guest',selectedId],queryFn:({signal})=>request('/api/spotmap?spot='+encodeURIComponent(selectedId!),{signal,cache:'no-store'}),enabled:!!selectedId&&sessionReady});
 const selected=(comments.data?.spot.id===selectedId?comments.data.spot:null)||data.spots.find(s=>s.id===selectedId);
 useEffect(()=>{const readLink=()=>{const course=sharedCourseId(window.location.search);setSharedCourse(course);if(course){setSelectedId(null);setTab('saved');return;}const id=sharedSpotId(window.location.search);if(id){setSelectedId(id);setTab('map');}};readLink();window.addEventListener('popstate',readLink);return()=>window.removeEventListener('popstate',readLink);},[]);
 function closeSharedCourse(){setSharedCourse(null);const url=new URL(window.location.href);url.searchParams.delete('course');window.history.replaceState(window.history.state,'',url);}
 useEffect(()=>{if(selectedId&&comments.isError&&!selected)toast.error(comments.error.message);},[selectedId,comments.isError,comments.error,selected]);
 const mutation=useMutation({mutationFn:(b:Record<string,unknown>)=>request('/api/spotmap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),onSuccess:async()=>{await Promise.all([client.invalidateQueries({queryKey:['spotmap']}),client.invalidateQueries({queryKey:['comments']}),client.invalidateQueries({queryKey:['me']})]);},onError:e=>toast.error(e.message)});
 async function run(b:Record<string,unknown>,message?:string){if(!data.user){setDialog('login');return false;}try{await mutation.mutateAsync(b);if(message)toast.success(message);return true;}catch{return false;}}
 const filtered=useMemo(()=>{let a=data.spots.filter(s=>(category==='전체'||(category==='AR 기록'?s.ar:s.category===category))&&(!search||`${s.title} ${s.body} ${s.location}`.toLowerCase().includes(search.toLowerCase()))&&(!area||distance(area.point,s)<=3000));if(sort==='likes')a=[...a].sort((a,b)=>b.likes-a.likes);else if(sort==='near'&&(area||gps))a=[...a].sort((a,b)=>distance(area?.point||gps!,a)-distance(area?.point||gps!,b));else a=[...a].sort((a,b)=>a.example-b.example||Date.parse(b.createdAt)-Date.parse(a.createdAt));return a;},[data.spots,category,search,sort,gps,area]);
 function openSpot(s:Spot){setSelectedId(s.id);setComment('');map.current?.pan(s);}
 function chooseSave(s:Spot){if(!data.user){setDialog('login');return;}setSaveSpot(s);}
 function followSpots(spots:Spot[],title:string,mode:'walk'|'run'='walk'){setSelectedId(null);setFollow({spots,title,mode});}
 function startCreate(source:Spot|null=null,point?:Point,ar=false){if(!data.user){setDialog('login');return;}const next=point||map.current?.center()||DEFAULT_CENTER;setTab('map');setDraftPoint({lat:next.lat,lng:next.lng});setDraftAR(ar);setStorySource(source);setDraftRoute([]);setComposeKey(v=>v+1);setSelectedId(null);setCompose(true);}

 function chooseArea(point:Point,label:string){setArea({point:{lat:point.lat,lng:point.lng},label});setWelcome(false);setPanelHidden(false);setSearch('');setPlaceResults([]);setSort('near');map.current?.pan(point);}
 async function myLocation(){if(locating)return;setLocating(true);try{const p=await locate();const point={lat:p.coords.latitude,lng:p.coords.longitude};setGPS(point);chooseArea(point,'내 주변');toast.success('주변 3km의 기록을 둘러보세요.');}catch(e){toast.error((e as Error).message);}finally{setLocating(false);}}
 async function searchPlace(e:React.FormEvent){e.preventDefault();if(!search.trim())return;setSearchBusy(true);try{if(provider==='kakao'){const results=await map.current?.search(search)||[];setPlaceResults(results);if(!results.length)toast('골목 검색 결과가 없어요. 다른 이름으로 기웃거려보세요.');}else if(filtered[0])map.current?.pan(filtered[0]);else toast('등록된 기록에 없는 장소예요. 다른 검색어로 찾아보세요.');}finally{setSearchBusy(false);}}
 function editProfile(){setNickname(data.user?.nickname||'');setBio(data.user?.bio||'');setAvatarSkin(data.user?.avatarSkin||'wave');setDialog('profile');}
 useEffect(()=>{if(window.location.hash==='#login'&&!userId)setDialog('login');},[userId]);
 const badgeCount=achievements.filter(b=>b.earned).length;
 useGiutMotion(appRoot,tab,`${category}|${sort}|${filtered.map(s=>s.id).join(',')}`);
 return <Tabs ref={appRoot} value={tab} onValueChange={v=>{setTab(v);setDrawing(false);}} className={'spotmap-app '+(welcome?'show-welcome ':'')+(panelHidden?'panel-is-hidden':'')}>
  <header className="app-header"><button className="brand" onClick={()=>{setTab('map');document.getElementById('giut-intro')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}} aria-label="기웃 브랜드 소개로"><img className="giut-logo" src="/brand/logo.svg" alt="GIUT"/><span className="brand-caption">조금 다른 동네 발견</span></button>
   <TabsList className="main-nav"><span className="nav-indicator" aria-hidden="true"/><TabsTrigger value="map"><Compass/><span>지도</span></TabsTrigger><TabsTrigger value="ar"><ScanLine/><span>탐험</span></TabsTrigger><TabsTrigger value="saved"><Bookmark/><span>저장</span></TabsTrigger><TabsTrigger value="my"><UserRound/><span>마이</span></TabsTrigger></TabsList>
   <div className="header-actions"><button className="icon-button notification-button" aria-label={`골목 소식${activity.data?.unread?`, 새 알림 ${activity.data.unread}개`:''}`} onClick={()=>setNotifications(true)}><Bell size={20}/>{!!activity.data?.unread&&<i/>}</button><button className="avatar" aria-label={data.user?'내 프로필':'로그인'} onClick={()=>data.user?setTab('my'):setDialog('login')}>{data.user?<ProfileAvatar user={data.user}/>:<UserRound size={19}/>}</button></div>
  </header>
  <TabsContent value="map" forceMount={mapExiting?true:undefined} hidden={tab!=='map'&&!mapExiting} aria-hidden={tab!=='map'} inert={tab!=='map'} className={'map-workspace '+(mapExiting?'is-exiting-to-ar':'')}>
   <ExplorePanel expanded={expanded} onExpanded={setExpanded} hidden={panelHidden||drawing} onHidden={setPanelHidden} intro={welcome?<ExploreWelcome onNearby={()=>void myLocation()} busy={locating}/>:<div className="explore-area"><span><MapPin size={16}/>{area?area.label:'모든 지역'}<small>{area?'주변 3km':'공개된 사진과 이야기'}</small></span>{area&&<button aria-label="지역 필터 해제" onClick={()=>setArea(null)}><X size={16}/></button>}</div>}>
    <div className="list-heading"><span>{search?'검색 결과':'발견한 스팟'} <b>{filtered.length}</b></span><Select value={sort} onValueChange={v=>{setSort(v);if(v==='near'&&!gps&&!area)myLocation();}}><SelectTrigger className="sort-select" aria-label="골목 정렬"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="latest">최신순</SelectItem><SelectItem value="likes">인기순</SelectItem><SelectItem value="near">가까운순</SelectItem></SelectContent></Select></div>
    {query.isError&&<div className="inline-error" role="alert">기록을 불러오지 못했어요.<button onClick={()=>query.refetch()}>다시 시도</button></div>}
    <div className="spot-list">{filtered.map((s,i)=><SpotCard key={s.id} spot={s} featured={i===0} gps={gps} onOpen={()=>openSpot(s)} onSave={()=>chooseSave(s)} pending={mutation.isPending}/>)}{!filtered.length&&<div className="empty-state"><MapPin size={28}/><h3>이 근처의 첫 이야기를 기다려요.</h3><p>위치가 맞다면 사진이나 한 줄을 남겨보세요.</p><button className="text-button" onClick={()=>startCreate()}>여기에 첫 기록 남기기 <Plus size={16}/></button><button className="text-button" onClick={()=>{setSearch('');setCategory('전체');setArea(null);}}>다른 지역의 기록 보기 <ArrowRight size={16}/></button></div>}</div>
    <div className="panel-footer"><span>발견은 가까운 곳에.</span><button onClick={()=>setDialog('about')}>기웃 이야기 <ArrowUpRight size={13}/></button></div>
   </ExplorePanel>
   <section className="map-stage">
    <MapCanvas spots={filtered} selected={selectedId||undefined} kakaoKey={query.data?.kakaoKey} draftRoute={draftRoute} currentLocation={gps||undefined} onSelect={openSpot} onPick={p=>{if(drawing)setDraftRoute(v=>[...v,p]);}} onReady={c=>{map.current=c;if(area)c.pan(area.point);}} onProvider={setProvider}/>
    <div className="map-toolbar"><form className="search-box" onSubmit={searchPlace}><Search size={20}/><input aria-label="장소와 골목 검색" placeholder="동네, 장소, 발견하고 싶은 순간" value={search} onChange={e=>{setSearch(e.target.value);setPlaceResults([]);}}/>{search&&<button type="button" aria-label="검색어 지우기" onClick={()=>{setSearch('');setPlaceResults([]);}}><X size={17}/></button>}<button className="search-submit" aria-label="검색" disabled={searchBusy}>{searchBusy?<LoaderCircle className="spin" size={17}/>:<ArrowRight size={18}/>}</button></form>
     {!!placeResults.length&&<div className="place-results">{placeResults.map((p,i)=><button key={i} onClick={()=>{chooseArea(p,p.name);}}><MapPin size={17}/><span><strong>{p.name}</strong><small>{p.address}</small></span><ArrowUpRight size={15}/></button>)}</div>}
     <div className="category-chips">{CATEGORIES.map(c=><button key={c} className={c===category?'active':''} aria-pressed={c===category} onClick={()=>setCategory(c)}><Icon category={c}/>{c}</button>)}</div>
    </div>
    <div className="map-top-note"><Compass size={14}/>기웃이와 함께 탐험 중</div>
    {!drawing&&!welcome&&<div className="map-bottom-note mascot-guide"><Giuti pose="curious" animated/><div><small>기웃이의 작은 힌트</small><strong>{gps&&data.spots.some(s=>s.ar&&distance(gps,s)<=100)?'100m 안에 AR 이야기가 있어요.':'골목에 남겨진 이야기를 찾아요.'}</strong><p>지도에서 고르고, 가까이 가서 발견해요.</p></div><button aria-label="이야기 찾으러 가기" onClick={()=>setTab('ar')}><ArrowUpRight size={22}/></button></div>}
    <div className="map-controls"><button aria-label="현재 위치" onClick={myLocation}><LocateFixed size={20}/></button><div><button aria-label="지도 확대" onClick={()=>map.current?.zoom(1)}><Plus size={21}/></button><button aria-label="지도 축소" onClick={()=>map.current?.zoom(-1)}><Minus size={21}/></button></div><button aria-label="지도 연결 정보" onClick={()=>setDialog('settings')}><SlidersHorizontal size={19}/></button></div>
    {!drawing&&<button className="record-fab" aria-label="이 장소에 기록 남기기" onClick={()=>startCreate()}><Plus size={24}/><span>기록 남기기</span></button>}

    {drawing&&<div className="route-toolbar"><div><Route size={20}/><span>지도를 눌러 코스를 이어주세요<small>{draftRoute.length}개 지점 · {formatDistance(routeDistance(draftRoute))} · 직접 지정한 경로</small></span></div><button onClick={()=>setDraftRoute(p=>p.slice(0,-1))} disabled={!draftRoute.length}>되돌리기</button><button className="lime-button" onClick={()=>{setDrawing(false);setCompose(true);}}><Check size={18}/>완료</button></div>}
   </section>
  </TabsContent>
  <TabsContent value="ar" forceMount hidden={tab!=='ar'} className={'ar-tab '+(arEntering?'is-entering':'')}><ARView spots={data.spots} onSelect={openSpot} onCreate={p=>startCreate(null,p,true)} onBrowse={()=>{setTab('map');setCategory('AR 기록');setWelcome(false);setPanelHidden(false);setExpanded(true);}}/></TabsContent>
  <TabsContent value="saved" className="collection-page"><Scrapbook spots={data.spots} user={data.user} kakaoKey={data.kakaoKey} onOpen={openSpot} onFollow={followSpots} onLogin={()=>setDialog('login')} renderSpot={s=><SpotCard key={s.id} spot={s} featured onOpen={()=>openSpot(s)} onSave={()=>chooseSave(s)} pending={mutation.isPending}/>}/></TabsContent>
  <TabsContent value="my" className="profile-page">{!data.user?<div className="page-heading"><h1>나의 골목 영역</h1><SignInCard onClick={()=>setDialog('login')}/></div>:<>
   <div className="profile-cover"><div className="profile-avatar"><ProfileAvatar user={data.user}/></div><div><p className="eyebrow">MY GIUT LOG</p><h1>{data.user.nickname}</h1><p>{data.user.bio||'기웃이와 함께 골목을 탐험 중.'}</p></div><button className="outline-button" onClick={editProfile}><Settings2 size={16}/>프로필 꾸미기</button></div>
   {personal.isError&&<div className="inline-error" role="alert">내 저장소를 불러오지 못했어요.<button onClick={()=>personal.refetch()}>다시 시도</button></div>}
   <section className="my-workspace-section"><div className="section-title"><h2>나의 산책·러닝 코스</h2><button className="text-button" onClick={()=>setTab('saved')}>코스 관리 <ArrowRight size={16}/></button></div>{workspace?.myCourses.length?<div className="my-course-list">{workspace.myCourses.map(c=><button key={c.id} onClick={()=>setTab('saved')}><span><strong>{c.title}</strong><small>{c.mode==='run'?'러닝':'산책'} · {c.spotIds.length}개 장소</small></span><ArrowUpRight size={18}/></button>)}</div>:<p className="muted">{personal.isPending?'나의 코스를 불러오는 중…':'저장 탭에서 장소를 이어 나만의 코스를 만들어보세요.'}</p>}</section>
   {!!workspace?.likedSpots.length&&<section className="my-workspace-section"><div className="section-title"><h2>내가 좋아한 장소</h2><span>{workspace.interactions.likedSpotIds.length}곳</span></div><div className="collection-grid">{workspace.likedSpots.map(s=><SpotCard key={s.id} spot={s} featured onOpen={()=>openSpot(s)} onSave={()=>chooseSave(s)} pending={mutation.isPending}/>)}</div></section>}
   <div className="profile-stats"><div><strong>{data.user.postCount}</strong><span>내 기록</span></div><div><strong>{data.user.receivedLikes}</strong><span>받은 좋아요</span></div><div><strong>{data.user.savedCount}</strong><span>저장한 장소</span></div><button onClick={()=>setDialog('wallet')}><strong><span className="coin">냥</span>{data.user.balance}</strong><span>냥 주머니 <ArrowUpRight size={13}/></span></button></div>
   <section className="badge-section"><div className="section-title"><h2>기웃이의 탐험 배지</h2><span>배지 {badgeCount} / 4</span></div><div className="badge-grid">{achievements.map(b=><article key={b.id} className={'badge-card '+(b.earned?'earned':'locked')}><div className={'badge-emblem '+b.color}><Giuti pose={b.id==='first'?'explore':b.id==='explorer'?'wave':b.id==='ar'?'curious':'love'} animated={b.earned} label=""/>{!b.earned&&<LockKeyhole size={12} className="badge-lock"/>}</div><strong>{b.name}</strong><p>{b.text}</p><Progress value={b.progress/b.target*100} className="badge-progress"/><small>{b.earned?'영역 인정!':`${b.progress} / ${b.target}`}</small></article>)}</div></section>
   <section><div className="section-title"><h2>내 기록</h2><button className="text-button" onClick={()=>startCreate()}><Plus size={16}/>새 흔적</button></div>{owned.length?<div className="collection-grid">{owned.map(s=><SpotCard key={s.id} spot={s} featured onOpen={()=>openSpot(s)} onSave={()=>chooseSave(s)} pending={mutation.isPending}/>)}</div>:<div className="empty-state"><Camera size={32}/><h3>첫 발도장을 기다리고 있어요.</h3><p>볕 좋은 담벼락도, 조용한 골목도 좋아요.</p><button className="text-button" onClick={()=>startCreate()}>첫 흔적 남기기 <ArrowRight size={16}/></button></div>}</section>
  </>}</TabsContent>
  <Sheet open={!!selected} onOpenChange={o=>{if(!o)setSelectedId(null);}}><SheetContent className="detail-sheet" side="right">{selected&&<>
   <SheetHeader className="sr-only"><SheetTitle>{selected.title}</SheetTitle><SheetDescription>사진, 장소 이야기와 댓글</SheetDescription></SheetHeader>
   <div className="detail-scroll"><div className={'detail-photo '+(!selected.image?'text-photo':'')}>{selected.image?<img src={selected.image} alt={selected.title}/>:<MessageCircle size={64} strokeWidth={1}/>}<span className="detail-category"><Icon category={selected.category}/>{selected.category}</span>{selected.example===1&&<span className="detail-example">예시 기록</span>}</div>
    <div className="detail-body"><div className="author-line"><span className="small-avatar">{selected.nickname.slice(0,1)}</span><div><strong>{selected.nickname}</strong><small>{selected.example?'제공 사진으로 구성한 기웃이의 예시':date(selected.createdAt)+' 등록'}</small></div>{selected.userId===data.user?.id?<button className="icon-button" aria-label="내 골목 기록 삭제" onClick={()=>setDeleteTarget({spotId:selected.id})}><Trash2 size={17}/></button>:<button className="icon-button" aria-label="골목 기록 신고" onClick={()=>{setReport('');setDialog('report');}}><Flag size={17}/></button>}</div>
     <h2>{selected.title}</h2><p className="detail-location"><MapPin size={15}/>{selected.location}</p><button className="together-button" onClick={()=>followSpots([selected],selected.title)}><span><Giuti pose="explore" animated label=""/></span><span><strong>같이 기웃거리기</strong><small>흰 발자국을 따라 이 장소까지</small></span><ArrowUpRight size={21}/></button>{selected.body&&<p className="detail-text">{selected.body}</p>}
     {selected.route.length>1&&<div className="route-info"><Route size={20}/><span>러닝 코스 · {formatDistance(routeDistance(selected.route))}<small>작성자가 직접 지정한 경로 · 이동 전 통행 가능 여부를 확인하세요.</small></span></div>}
     <div className="detail-actions"><button className={selected.liked?'is-liked':''} disabled={mutation.isPending} onClick={()=>run({op:'reaction',spotId:selected.id,kind:'like',active:!selected.liked})}><Heart size={20} fill={selected.liked?'currentColor':'none'}/>좋아요 {selected.likes}</button><button className={selected.saved?'is-saved':''} disabled={mutation.isPending} onClick={()=>chooseSave(selected)}><Bookmark size={20} fill={selected.saved?'currentColor':'none'}/>{selected.saved?'저장됨':'저장'} {selected.saves}</button><a href={`https://map.kakao.com/link/to/${encodeURIComponent(selected.title)},${selected.lat},${selected.lng}`} target="_blank" rel="noreferrer"><Navigation size={19}/>길찾기</a></div>
     <SpotShare spot={selected} className="spot-share-detail" label/>
     <DiscoveryButton spot={selected} userId={userId} onLogin={()=>setDialog('login')}/>
     <PlaceStories spot={selected} stories={comments.data?.stories||[]} loading={comments.isPending} error={comments.isError} onRetry={()=>comments.refetch()} onOpen={id=>{setSelectedId(id);setComment('');}} onWrite={()=>startCreate(selected)}/>
     {!!selected.ar&&<button className="ar-detail-cta" onClick={()=>{setSelectedId(null);setTab('ar');}}><ScanLine size={24}/><span><strong>이 골목에 숨겨진 AR 흔적</strong><small>100m 안에서 탐지 · 20m 안에서 메모 발견</small></span><ArrowUpRight size={20}/></button>}
     <section className="comments-section"><h3>댓글 <span>{selected.comments}</span></h3>{comments.isPending?<p className="muted">댓글을 불러오는 중…</p>:comments.isError?<button className="text-button" onClick={()=>comments.refetch()}>댓글 다시 불러오기</button>:comments.data?.comments.length?comments.data.comments.map(c=><article className="comment" key={c.id}><span className="small-avatar">{c.nickname.slice(0,1)}</span><div><strong>{c.nickname}</strong><p>{c.body}</p><small>{date(c.createdAt)}</small></div>{c.userId===data.user?.id&&<button aria-label="댓글 삭제" onClick={()=>setDeleteTarget({spotId:selected.id,commentId:c.id})}><X size={14}/></button>}</article>):<p className="muted">첫 댓글을 남겨보세요.</p>}</section>
     {selected.example===1&&<p className="photo-attribution">제공 사진으로 만든 화면 예시 · 실제 촬영 위치와 지도 좌표는 다를 수 있어요. <button onClick={()=>setDialog('about')}>예시 안내</button></p>}
    </div>
   </div><form className="comment-form" onSubmit={async e=>{e.preventDefault();if(await run({op:'comment',spotId:selected.id,body:comment}))setComment('');}}><Input placeholder="댓글을 남겨주세요" aria-label="댓글" value={comment} onChange={e=>setComment(e.target.value)} maxLength={500}/><button aria-label="댓글 등록" disabled={!comment.trim()||mutation.isPending}><Send size={19}/></button></form>
  </>}</SheetContent></Sheet>
  <SavePicker spot={saveSpot} spots={data.spots} onClose={()=>setSaveSpot(null)}/>
  {sharedCourse&&<CourseDetail courseId={sharedCourse} kakaoKey={data.kakaoKey} onClose={closeSharedCourse} onOpen={s=>{closeSharedCourse();openSpot(s);}} onFollow={(items,title,mode)=>{closeSharedCourse();followSpots(items,title,mode);}}/>}
  {follow&&<FollowGuide key={follow.spots.map(s=>s.id).join(',')} target={follow} kakaoKey={data.kakaoKey} onClose={()=>setFollow(null)} onOpen={openSpot}/>}

  <RecordComposer key={composeKey} open={compose} setOpen={setCompose} point={draftPoint} initialAR={draftAR} source={storySource} route={draftRoute} pending={mutation.isPending} onPick={()=>{const next=map.current?.center()||draftPoint;setDraftPoint({lat:next.lat,lng:next.lng});toast.success('현재 지도 중심을 기록 위치로 선택했어요.');}} onDraw={()=>{setCompose(false);setSelectedId(null);setWelcome(false);setTab('map');setDrawing(true);}} onSubmit={async b=>{if(!data.user){setDialog('login');return false;}try{const result=await mutation.mutateAsync({...b,op:'create'});setCompose(false);setDraftRoute([]);setTab('map');chooseArea({lat:Number(b.lat),lng:Number(b.lng)},String(b.location));setCategory('전체');setSelectedId(result.id);toast.success('이 위치에 기록을 공개했어요.',{description:'지도에서 보고, 현장에서는 AR로도 찾을 수 있어요.'});return true;}catch{return false;}}}/>
  <Dialog open={dialog!==null} onOpenChange={o=>{if(!o)setDialog(null);}}><DialogContent className={'app-dialog '+(dialog==='wallet'?'wallet-dialog':dialog==='login'?'login-dialog':'')}>
   {dialog==='login'&&<><DialogHeader><DialogTitle>우리, 조금 더 기웃해볼까요?</DialogTitle><DialogDescription>로그인하고 나만의 장소와 이야기를 모아보세요.</DialogDescription></DialogHeader><div className="login-mark giuti-login"><Giuti pose="wave" animated/></div><AuthPanel/></>}
   {dialog==='wallet'&&<><DialogHeader><DialogTitle>냥코인 지갑</DialogTitle><DialogDescription>골목의 진짜 장면을 나눌 때마다 차곡차곡!</DialogDescription></DialogHeader><div className="wallet-card"><span>GIUT NYANG COINS</span><div><span className="coin">냥</span><strong>{(data.user?.balance||0).toLocaleString()}</strong></div><small>현금으로 환전되지 않는 서비스 내부 포인트</small><Giuti pose="love" animated className="wallet-cat"/></div><div className="credit-rules"><p><span>골목 흔적 남기기</span><strong>+10 냥 <small>하루 5회</small></strong></p><p><span>다른 사람의 흔적에 좋아요</span><strong>+1 냥 <small>하루 10회</small></strong></p><small>같은 글에는 한 번만 적립돼요. 내 글과 예시 기록은 좋아요 적립에서 제외돼요.</small></div><h3>냥코인 발자국</h3><div className="ledger">{data.ledger.length?data.ledger.map(l=><div key={l.id}><span><strong>{l.reason==='스팟 기록'?'골목 흔적':l.reason==='스팟에 공감'?'골목에 공감':l.reason}</strong><small>{date(l.createdAt)}</small></span><b>+{l.amount} 냥</b></div>):<p className="muted">첫 흔적을 남기면 활동 내역이 생겨요.</p>}</div></>}
   {dialog==='profile'&&<><DialogHeader><DialogTitle>나를 소개해주세요.</DialogTitle><DialogDescription>닉네임과 소개는 다른 사람에게 보여요.</DialogDescription></DialogHeader><form className="profile-form" onSubmit={async e=>{e.preventDefault();if(await run({op:'profile',nickname,bio,avatarSkin},'프로필을 수정했어요.'))setDialog(null);}}><AvatarPicker value={avatarSkin} onChange={setAvatarSkin} user={data.user}/><label>닉네임<Input value={nickname} onChange={e=>setNickname(e.target.value)} minLength={2} maxLength={20} required/></label><label>한 줄 소개<Textarea value={bio} onChange={e=>setBio(e.target.value)} maxLength={160} placeholder="주말이면 동네를 걷는 사람"/></label><Button className="primary-button" disabled={mutation.isPending}>저장하기</Button></form><SignOutButton onDone={()=>{setDialog(null);setTab('map');}}/></>}
   {dialog==='report'&&<><DialogHeader><DialogTitle>이 기록 신고하기</DialogTitle><DialogDescription>개인정보 노출, 부적절한 사진, 잘못된 장소 등의 사유를 적어주세요.</DialogDescription></DialogHeader><Textarea aria-label="신고 사유" value={report} onChange={e=>setReport(e.target.value)} maxLength={500}/><Button className="primary-button" disabled={report.trim().length<2||mutation.isPending} onClick={async()=>{if(await run({op:'report',spotId:selectedId,reason:report},'신고 내용을 접수했어요.'))setDialog(null);}}>신고 접수</Button></>}
   {dialog==='settings'&&<><DialogHeader><DialogTitle>지도 둘러보기</DialogTitle><DialogDescription>내 주변을 찾거나, 궁금한 동네로 지도를 움직여보세요.</DialogDescription></DialogHeader><p>사진 핀을 누르면 그 장소의 이야기가 열려요. 마음에 드는 기록은 저장해두고, 직접 찾아갔다면 ‘발견했어요’로 마음을 전해보세요.</p><button className="primary-button" onClick={()=>{setDialog(null);void myLocation();}}>내 주변 둘러보기</button><p className="form-note">{provider==='kakao'?'장소 이름으로 검색할 수 있어요.':'현재 지도에서는 등록된 기록을 검색할 수 있어요. 다른 지역은 지도에서 직접 골라주세요.'}</p></>}
   {dialog==='about'&&<><DialogHeader><DialogTitle>사람들이 지나친 곳, 길냥이들의 영역.</DialogTitle><DialogDescription>골목대장 기웃이와 함께 찾는 진짜 로컬 스팟.</DialogDescription></DialogHeader><div className="about-copy giut-world"><Giuti pose="explore"/><p><strong>뻔한 인스타 핫플은 사람들의 영역.</strong><br/>하지만 좁은 골목길, 볕이 잘 드는 담벼락 뒤, 숨겨진 장소는 길냥이들의 영역이에요. 골목대장 고양이 기웃이와 함께 새로운 곳을 기웃거리며 진짜 로컬 스팟을 찾아보세요.</p><p>지도에서 골목을 고르거나 + 버튼을 누르면 사진과 이야기를 남길 수 있어요. 기록과 댓글은 이 사이트에 접근할 수 있는 사람들에게 공개돼요.</p><p>AR 기웃은 GPS를 이용해 근처의 흔적을 카메라 화면에 표시해요. 실제 사물에 정밀하게 고정되는 공간 AR과는 위치 오차가 있어요.</p><h3>예시 사진 안내</h3><p>소개 화면과 지도 예시 기록에는 제공받은 이미지가 사용됐어요. 지도에 표시된 핀은 기능을 보여주기 위한 예시 위치이며, 사진을 촬영한 실제 장소를 뜻하지 않습니다.</p></div></>}
  </DialogContent></Dialog>
  <Sheet open={notifications} onOpenChange={setNotifications}><SheetContent className="notifications-sheet"><SheetHeader><SheetTitle>골목 소식</SheetTitle><SheetDescription>내 기록이 누군가의 발견으로 이어지는 순간.</SheetDescription></SheetHeader><ActivityList userId={userId} onLogin={()=>{setNotifications(false);setDialog('login');}} onOpen={id=>{setNotifications(false);setSelectedId(id);setComment('');}}/></SheetContent></Sheet>
  <AlertDialog open={!!deleteTarget} onOpenChange={o=>{if(!o)setDeleteTarget(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{deleteTarget?.commentId?'댓글을 삭제할까요?':'이 골목 흔적을 지울까요?'}</AlertDialogTitle><AlertDialogDescription>삭제한 내용은 되돌릴 수 없어요.{!deleteTarget?.commentId&&' 이 기록의 댓글과 반응도 함께 삭제돼요.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={async()=>{if(deleteTarget&&await run({op:deleteTarget.commentId?'delete-comment':'delete',...deleteTarget},'삭제했어요.')){if(!deleteTarget.commentId)setSelectedId(null);setDeleteTarget(null);}}}>삭제하기</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </Tabs>;
}

function SignInCard({onClick}:{onClick:()=>void}){return <div className="empty-state large"><Giuti pose="wave" animated className="empty-giuti"/><h3>좋아하는 동네를 모아볼까요?</h3><p>로그인하면 내 기록과 저장한 장소가 계정에 남아요.</p><Button className="lime-button" onClick={onClick}>로그인하고 기웃하기 <ArrowRight size={17}/></Button></div>;}
function SpotCard({spot:s,featured=false,onOpen,onSave,gps,pending}:{spot:Spot;featured?:boolean;onOpen:()=>void;onSave:()=>void;gps?:Point|null;pending?:boolean}){
 return <article className={'spot-card '+(featured?'featured':'')}>
  <button className="spot-open" onClick={onOpen} aria-label={s.title+' 열기'}>
   <div className="spot-photo">{s.image?<img src={s.image} alt="" loading="lazy"/>:<div className="note-card-preview"><MessageCircle size={25}/><p>{s.body.slice(0,45)}</p></div>}{!!s.ar&&<span className="ar-label"><ScanLine size={13}/>AR 기록</span>}{!!s.example&&<span className="example-label">예시 기록</span>}</div>
   <div className="spot-info"><span className="category-label"><Icon category={s.category} size={13}/>{s.category}{gps&&<small>· {formatDistance(distance(gps,s))}</small>}</span><h3 className="card-title">{s.title}</h3><p>{s.location}</p><small className="record-time">{s.example?'체험용 · 현재 모습과 다를 수 있어요.':date(s.createdAt)+' 등록'}</small><div className="card-meta"><span><Heart size={13}/>{s.likes}</span><span><MessageCircle size={13}/>{s.comments}</span>{!!s.discoveries&&<span aria-label={`${s.discoveries}명이 발견했어요`}><Footprints size={13}/>{s.discoveries}</span>}<span className="card-author">{s.example?'기웃이':s.nickname}</span></div></div>
  </button>
  <button className={'card-save '+(s.saved?'saved':'')} onClick={onSave} disabled={pending} aria-pressed={!!s.saved} aria-label={s.saved?s.title+' 저장 해제':s.title+' 저장'}><Bookmark size={17} fill={s.saved?'currentColor':'none'}/></button>
 </article>;
}
