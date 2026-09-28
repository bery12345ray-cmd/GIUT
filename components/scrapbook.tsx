'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {Bookmark,Plus,FolderHeart,LockKeyhole,ChevronLeft,ChevronUp,ChevronDown,ArrowUpRight,ArrowRight,Route,Footprints,Trash2,Pencil,Check,LoaderCircle,X,MapPin} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from '@/components/ui/alert-dialog';
import {Checkbox} from '@/components/ui/checkbox';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Input} from '@/components/ui/input';
import {toast} from 'sonner';
import Giuti from '@/components/giuti';
import {type Collections,type Course} from '@/lib/collections';
import {type Spot,type Profile} from '@/lib/model';

import {useCollections,useCollectionActions} from '@/hooks/use-collections';
import CourseEditor from './course-editor';
import CourseDetail from './course-detail';

const empty:Collections={folders:[],courses:[]};
function FolderCover({ids,spots}:{ids:string[];spots:Spot[]}){const images=ids.map(id=>spots.find(s=>s.id===id)?.image).filter((v):v is string=>!!v).slice(0,3);return <div className={'folder-cover '+(!images.length?'no-cover':'')}>{images.length?images.map((src,i)=><img key={i} src={src} alt="" loading="lazy"/>):<FolderHeart size={28}/>}</div>;}

export function SavePicker({spot,spots,onClose}:{spot:Spot|null;spots:Spot[];onClose:()=>void}){
 const query=useCollections(!!spot),mutation=useCollectionActions();const [creating,setCreating]=useState(false),[name,setName]=useState('');
 useEffect(()=>{setCreating(false);setName('');},[spot?.id]);
 async function create(e:React.FormEvent){e.preventDefault();if(!spot||!name.trim())return;try{await mutation.mutateAsync({op:'folder-create',name,spotId:spot.id});setName('');setCreating(false);toast.success('새 폴더에 저장했어요.');}catch{}}
 return <Dialog open={!!spot} onOpenChange={o=>{if(!o)onClose();}}><DialogContent className="app-dialog save-picker"><DialogHeader><DialogTitle>어디에 담아둘까요?</DialogTitle><DialogDescription>{spot?.title} · 여러 폴더에 저장할 수 있어요.</DialogDescription></DialogHeader>
  {query.isPending?<p className="collection-loading"><LoaderCircle className="spin" size={18}/>폴더를 불러오는 중…</p>:query.isError?<div className="collection-error"><p>폴더를 불러오지 못했어요.</p><button onClick={()=>query.refetch()}>다시 시도</button></div>:<div className="save-folder-list">{query.data?.folders.map(f=><label className="save-folder-row" key={f.id}><FolderCover ids={f.spotIds} spots={spots}/><span><strong>{f.name}</strong><small><LockKeyhole size={12}/>나만 보기 · {f.spotIds.length}개 장소</small></span><Checkbox checked={!!spot&&f.spotIds.includes(spot.id)} disabled={mutation.isPending} aria-label={f.name+'에 저장'} onCheckedChange={async active=>{if(!spot)return;try{await mutation.mutateAsync({op:'folder-toggle',id:f.id,spotId:spot.id,active:active===true});}catch{}}}/></label>)}</div>}
  <div className="save-picker-bottom">{creating?<form className="new-folder-form" onSubmit={create}><Input autoFocus aria-label="새 폴더 이름" placeholder="예: 주말에 기웃할 곳" maxLength={40} value={name} onChange={e=>setName(e.target.value)}/><button className="lime-button" disabled={!name.trim()||mutation.isPending}>만들기</button><button type="button" className="icon-button" aria-label="폴더 만들기 취소" onClick={()=>setCreating(false)}><X size={17}/></button></form>:<button className="new-folder-button" onClick={()=>setCreating(true)} disabled={query.isError||query.isPending}><Plus size={21}/>새 저장 폴더</button>}<button className="text-button picker-done" onClick={onClose}><Check size={16}/>완료</button></div>
 </DialogContent></Dialog>;
}

type Props={spots:Spot[];user:Profile|null;kakaoKey:string;renderSpot:(s:Spot)=>ReactNode;onOpen:(s:Spot)=>void;onFollow:(spots:Spot[],title:string,mode?:'walk'|'run')=>void;onLogin:()=>void};
export default function Scrapbook({spots,user,kakaoKey,renderSpot,onOpen,onFollow,onLogin}:Props){
 const query=useCollections(),mutation=useCollectionActions(),data=query.data||empty;
 const [view,setView]=useState<'folders'|'all'|'courses'>('folders'),[folderId,setFolderId]=useState<string|null>(null),[order,setOrder]=useState<string[]|null>(null);
 const [folderForm,setFolderForm]=useState<{id?:string;name:string}|null>(null),[remove,setRemove]=useState<{type:'folder'|'course';id:string}|null>(null);
 const [editor,setEditor]=useState<{course?:Course;ids:string[]}|null>(null),[selectedCourse,setSelectedCourse]=useState<string|null>(null);
 const folder=data.folders.find(f=>f.id===folderId),saved=spots.filter(s=>s.saved),orderedIds=order||folder?.spotIds||[];
 const folderItems=orderedIds.map(id=>spots.find(s=>s.id===id)).filter((s):s is Spot=>!!s);
 useEffect(()=>{setOrder(null);},[folderId]);
 function move(index:number,delta:number){const copy=[...orderedIds];[copy[index],copy[index+delta]]=[copy[index+delta],copy[index]];setOrder(copy);}
 async function saveOrder(){if(!folder)return;try{await mutation.mutateAsync({op:'folder-order',id:folder.id,spotIds:orderedIds});setOrder(null);toast.success('방문 순서를 저장했어요.');}catch{}}

 return <>
  <div className="page-heading scrapbook-heading"><div><p className="eyebrow">MY LITTLE COLLECTION</p><h1>{folder?folder.name:'다시 기웃거릴 곳'}</h1><p>{folder?'마음에 담아둔 장소를 나만의 순서로.':'장소를 모으고, 나만의 한 바퀴를 만들어보세요.'}</p></div><img className="scrapbook-hanging-cat" src="/giuti/hanging-v1.png" alt="배너에 매달린 기웃이"/></div>
  {folder?<>
   <div className="folder-toolbar"><button className="text-button" onClick={()=>{setFolderId(null);setOrder(null);}}><ChevronLeft size={17}/>폴더 목록</button><span><LockKeyhole size={13}/>나만 보기 · {folder.spotIds.length}곳</span><div>{!folder.isDefault&&<><button className="icon-button" aria-label="폴더 이름 변경" onClick={()=>setFolderForm({id:folder.id,name:folder.name})}><Pencil size={17}/></button><button className="icon-button" aria-label="폴더 삭제" onClick={()=>setRemove({type:'folder',id:folder.id})}><Trash2 size={17}/></button></>}</div></div>
   <div className="folder-course-prompt"><span><Route size={22}/><span><strong>이 장소들로 한 바퀴, 어때요?</strong><small>방문 순서를 정해서 산책·러닝 코스로 공유해요.</small></span></span><button className="lime-button" disabled={folderItems.length<2} onClick={()=>setEditor({ids:orderedIds})}>코스 만들기 <ArrowUpRight size={16}/></button></div>
   {!!order&&<div className="order-save-bar"><span>순서가 변경됐어요.</span><button className="text-button" onClick={()=>setOrder(null)}>취소</button><button className="lime-button" disabled={mutation.isPending} onClick={saveOrder}>순서 저장</button></div>}
   <div className="ordered-spots">{folderItems.map((s,i)=><article key={s.id} className="ordered-spot"><span className="stop-number">{i+1}</span><button className="ordered-spot-main" onClick={()=>onOpen(s)}>{s.image?<img src={s.image} alt=""/>:<span className="stop-photo-placeholder"><MapPin/></span>}<span><strong>{s.title}</strong><small>{s.location}</small></span></button><div className="order-buttons"><button aria-label={s.title+' 위로 이동'} disabled={i===0||mutation.isPending} onClick={()=>move(i,-1)}><ChevronUp size={17}/></button><button aria-label={s.title+' 아래로 이동'} disabled={i===folderItems.length-1||mutation.isPending} onClick={()=>move(i,1)}><ChevronDown size={17}/></button></div><button className="icon-button" aria-label={s.title+' 폴더에서 빼기'} disabled={mutation.isPending} onClick={async()=>{try{await mutation.mutateAsync({op:'folder-toggle',id:folder.id,spotId:s.id,active:false});setOrder(null);}catch{}}}><X size={16}/></button></article>)}</div>
   {!folderItems.length&&<div className="empty-state large"><Giuti pose="sleep" animated className="empty-giuti"/><h3>아직 비어 있는 폴더예요.</h3><p>장소의 저장 버튼을 눌러 이 폴더에 담아보세요.</p></div>}
  </>:<Tabs value={view} onValueChange={v=>setView(v as typeof view)} className="scrapbook-view">
   <TabsList className="scrapbook-tabs" aria-label="저장한 장소와 코스">{([['folders','저장 폴더'],['all','전체 저장'],['courses','공유 코스']] as const).map(([id,label])=><TabsTrigger key={id} value={id}>{label}{id==='all'&&<span>{saved.length}</span>}</TabsTrigger>)}</TabsList><TabsContent value={view} className="scrapbook-content">
   {query.isError&&<div className="collection-error"><p>폴더와 코스를 불러오지 못했어요.</p><button onClick={()=>query.refetch()}>다시 시도</button></div>}
   {view!=='courses'&&!user?<div className="empty-state large"><Giuti pose="wave" animated className="empty-giuti"/><h3>좋아하는 장소를 모아볼까요?</h3><p>로그인하면 내 폴더를 만들 수 있어요.</p><button className="lime-button" onClick={onLogin}>로그인하고 저장하기 <ArrowRight size={17}/></button></div>:<>
    {view==='folders'&&<>{query.isPending?<p className="collection-loading"><LoaderCircle className="spin" size={18}/>폴더를 불러오는 중…</p>:<div className="folder-grid">{data.folders.map(f=><button className="folder-card" key={f.id} onClick={()=>setFolderId(f.id)}><FolderCover ids={f.spotIds} spots={spots}/><strong>{f.name}</strong><span><LockKeyhole size={12}/>나만 보기 · {f.spotIds.length}개 장소</span></button>)}<button className="folder-card add-folder" onClick={()=>setFolderForm({name:''})}><span><Plus size={28}/></span><strong>새 저장 폴더</strong><small>함께 가고 싶은 곳을 모아봐요.</small></button></div>}</>}
    {view==='all'&&(saved.length?<div className="collection-grid">{saved.map(s=>renderSpot(s))}</div>:<div className="empty-state large"><Giuti pose="sleep" animated className="empty-giuti"/><h3>아직 저장한 장소가 없어요.</h3><p>마음에 드는 사진의 책갈피를 눌러보세요.</p></div>)}
   </>}
   {view==='courses'&&<><div className="courses-toolbar"><p>함께 걷고 싶은 동네 한 바퀴.</p><button className="lime-button" onClick={()=>user?setEditor({ids:[]}):onLogin()}><Plus size={17}/>코스 만들기</button></div>{query.isPending?<p className="collection-loading">코스를 불러오는 중…</p>:data.courses.length?<div className="course-grid">{data.courses.map(c=><article className="course-card" key={c.id}><button onClick={()=>setSelectedCourse(c.id)}><FolderCover ids={c.spotIds} spots={spots}/><div><span className="course-mode"><Footprints size={13}/>공유 코스 · {c.spotIds.length}곳</span><h2>{c.title}</h2><p>{c.description||'이 길에서 만나는 작은 발견들.'}</p><small>{c.nickname}의 코스</small></div></button></article>)}</div>:<div className="empty-state large"><Giuti pose="explore" animated className="empty-giuti"/><h3>첫 번째 길잡이가 되어볼까요?</h3><p>저장한 장소를 이어 나만의 코스를 만들어보세요.</p></div>}</>}
  </TabsContent></Tabs>}
  <Dialog open={!!folderForm} onOpenChange={o=>{if(!o)setFolderForm(null);}}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>{folderForm?.id?'폴더 이름 바꾸기':'새 저장 폴더'}</DialogTitle><DialogDescription>폴더와 저장 목록은 나만 볼 수 있어요.</DialogDescription></DialogHeader><form className="folder-name-form" onSubmit={async e=>{e.preventDefault();if(!folderForm)return;try{await mutation.mutateAsync({op:folderForm.id?'folder-rename':'folder-create',...folderForm});setFolderForm(null);}catch{}}}><Input autoFocus aria-label="폴더 이름" maxLength={40} placeholder="예: 주말의 서울숲" value={folderForm?.name||''} onChange={e=>setFolderForm(f=>f?{...f,name:e.target.value}:null)}/><button className="primary-button" disabled={!folderForm?.name.trim()||mutation.isPending}>저장하기</button></form></DialogContent></Dialog>
  <AlertDialog open={!!remove} onOpenChange={o=>{if(!o)setRemove(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{remove?.type==='folder'?'이 폴더를 삭제할까요?':'이 코스를 삭제할까요?'}</AlertDialogTitle><AlertDialogDescription>{remove?.type==='folder'?'담아둔 장소는 ‘나중에 기웃거리기’에 보관돼요. 공유한 코스는 유지돼요.':'공유한 코스가 삭제돼요. 원본 장소 기록과 내 저장은 유지돼요.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction disabled={mutation.isPending} onClick={async()=>{if(!remove)return;try{await mutation.mutateAsync({op:remove.type+'-delete',id:remove.id});if(remove.type==='folder')setFolderId(null);else setSelectedCourse(null);setRemove(null);}catch{}}}>삭제하기</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  {editor&&<CourseEditor key={editor.course?.id||'new'} initial={editor} spots={spots} kakaoKey={kakaoKey} onClose={()=>setEditor(null)} onSaved={id=>{setEditor(null);setFolderId(null);setView('courses');setSelectedCourse(id);}}/>}
  {selectedCourse&&<CourseDetail courseId={selectedCourse} kakaoKey={kakaoKey} ownerId={user?.id} onClose={()=>setSelectedCourse(null)} onOpen={s=>{setSelectedCourse(null);onOpen(s);}} onFollow={(items,title,mode)=>{setSelectedCourse(null);onFollow(items,title,mode);}} onEdit={course=>{setEditor({course,ids:course.spotIds});setSelectedCourse(null);}} onDelete={course=>setRemove({type:'course',id:course.id})}/>}

 </>;
}
