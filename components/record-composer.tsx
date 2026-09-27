'use client';
import {useEffect,useRef,useState} from 'react';
import {Camera,MapPin,ScanLine,Route,LoaderCircle,ArrowUpRight,Globe,ChevronDown,RotateCcw,Check} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import CameraCapture,{type CameraCaptureControl} from '@/components/camera-capture';
import {currentRecordPoint,resolveRecordLocation,type RecordLocation} from '@/lib/record-location';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
import {CATEGORIES,distance,formatDistance,routeDistance,type Point,type Spot} from '@/lib/model';

export default function RecordComposer({open,setOpen,route,source,onDraw,onSubmit,pending}:{
  open:boolean;setOpen:(b:boolean)=>void;route:Point[];source:Spot|null;
  onDraw:()=>void;onSubmit:(b:Record<string,unknown>)=>Promise<boolean>;pending:boolean;
}) {
  const [title,setTitle]=useState(''),[body,setBody]=useState(''),[category,setCategory]=useState(source?.category||'사진 스팟');
  const [location,setLocation]=useState<RecordLocation|null>(null),[locationError,setLocationError]=useState(''),[locationBusy,setLocationBusy]=useState(false),[locationAttempt,setLocationAttempt]=useState(0),[publicConsent,setPublicConsent]=useState(false);
  const [image,setImage]=useState<string|null>(null),[uploading,setUploading]=useState(false),[preview,setPreview]=useState<string|null>(null);
  const capture=useRef<CameraCaptureControl>(null);
  const ready=!!title.trim()&&(!!image||!!body.trim())&&!!location&&publicConsent&&!locationBusy&&!uploading&&!pending;
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();setLocationBusy(true);setLocationError('');setLocation(null);setPublicConsent(false);
    void currentRecordPoint(controller.signal).then(point=>{
      if(source&&distance(point,source)>100)throw new Error('같은 장소의 이야기는 그 장소 가까이에서 남겨주세요.');
      return resolveRecordLocation(point,controller.signal);
    }).then(value=>{if(!controller.signal.aborted)setLocation(value);}).catch(e=>{
      if(!controller.signal.aborted)setLocationError(e instanceof Error?e.message:'현재 주소를 다시 확인해주세요.');
    }).finally(()=>{if(!controller.signal.aborted)setLocationBusy(false);});
    return()=>controller.abort();
  },[open,source,locationAttempt]);
  useEffect(()=>()=>{if(preview?.startsWith('blob:'))URL.revokeObjectURL(preview);},[preview]);
  async function upload(file:File) {
    if(file.size>20*1024*1024){toast.error('20MB 이하의 사진을 선택해주세요.');return;}
    setUploading(true);
    try{
      const bitmap=await createImageBitmap(file),scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
      canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('사진을 변환하지 못했어요.')),'image/jpeg',.86));
      const fd=new FormData();fd.append('file',blob,'spot.jpg');
      const response=await fetch('/api/upload',{method:'POST',body:fd});const result=await response.json();
      if(!response.ok)throw new Error(result.error||'사진 업로드를 다시 시도해주세요.');
      setImage(result.url);setPreview(URL.createObjectURL(blob));
    }catch(e){toast.error(e instanceof Error?e.message:'JPG 또는 PNG 사진으로 다시 선택해주세요.');}
    finally{setUploading(false);}
  }
  return <><CameraCapture ref={capture} onCapture={upload}/><Dialog open={open} onOpenChange={v=>{if(!pending&&!uploading)setOpen(v);}}><DialogContent className="compose-dialog simple-composer">
    <DialogHeader><p className="eyebrow">LEAVE A LITTLE DISCOVERY</p><DialogTitle>{source?'같은 자리, 나의 이야기':'오늘의 작은 발견 남기기'}</DialogTitle><DialogDescription>사진 한 장 또는 한 줄이면 충분해요.</DialogDescription></DialogHeader>
    <form onSubmit={async e=>{e.preventDefault();if(!ready||!location)return;await onSubmit({title,body,category,location:location.address||'현재 위치에 남긴 기록',lat:location.lat,lng:location.lng,image,ar:true,route,publicConsent,...(source?{sourceSpotId:source.id}:{})});}}>
      <button type="button" className={'upload-box '+(preview?'has-photo':'')} onClick={()=>capture.current?.open()} disabled={uploading||pending}>{preview?<img src={preview} alt="공개할 사진 미리보기"/>:<><span>{uploading?<LoaderCircle className="spin" size={27}/>:<Camera size={27}/>}</span><strong>{uploading?'사진을 올리는 중…':'사진 한 장 더하기'}</strong><small>사진 없이 이야기만 남겨도 좋아요.</small></>}{preview&&<span className="change-photo"><Camera size={14}/>다시 촬영하기</span>}</button>
      {image&&<button type="button" className="text-button remove-photo" disabled={uploading||pending} onClick={()=>{setImage(null);setPreview(null);}}>사진 빼기</button>}
      <label className="form-label">어디서 어떤 추억을 남겼나요?<Input value={title} onChange={e=>setTitle(e.target.value)} maxLength={80} required placeholder="예) 성수동 카페거리에서 찾은 인생 젤라또"/></label>
      <label className="form-label">여기서 발견한 작은 매력은?<Textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={2000} placeholder="오후 세 시, 벤치에 햇빛이 딱 들어요."/><span className="char-count">{body.length} / 2,000 · 사진이 있으면 생략 가능</span></label>
      <div className={'record-location-card '+(locationError?'has-error':'')} role="status">{locationBusy?<LoaderCircle size={21} className="spin"/>:<MapPin size={21}/>}<div><strong>{locationBusy?'현재 주소를 확인하고 있어요.':location?.address||(location?'현재 위치 확인 완료':'현재 위치를 확인해주세요.')}</strong><small>{locationError||location?.warning||'지금 있는 위치의 주소가 기록에 자동으로 저장돼요.'}</small></div><button type="button" aria-label="현재 주소 다시 확인" disabled={locationBusy||pending} onClick={()=>setLocationAttempt(v=>v+1)}><RotateCcw size={16}/></button></div>
      {source&&<p className="form-note">‘{source.title}’의 이야기와 함께 모여요.</p>}
      <div className="record-ar-included"><ScanLine size={21}/><span><strong>AR 메모 허용</strong><small>가까이 온 사람이 카메라로 이 기록을 찾아요.</small></span><Check size={19}/></div>
      <details className="record-extras" open={route.length>0||undefined}><summary>카테고리 · 코스<ChevronDown size={17}/></summary><div>
        <label className="form-label">카테고리<Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{CATEGORIES.filter(c=>c!=='전체'&&c!=='AR 기록').map(c=><SelectItem value={c} key={c}>{c}</SelectItem>)}</SelectContent></Select></label>
        {category==='러닝'&&<button type="button" className="outline-button" onClick={onDraw}><Route size={17}/>{route.length?'코스 수정':'코스 그리기'}</button>}
        {route.length>1&&<p className="form-note">직접 그린 경로 · {formatDistance(routeDistance(route))}</p>}

      </div></details>
      <div className="record-visibility"><div><Globe size={17}/><strong>공개 기록</strong><span>사진 · 이야기 · 현재 주소</span></div><label><input type="checkbox" checked={publicConsent} onChange={e=>setPublicConsent(e.target.checked)} required/>이 위치가 맞고, 다른 사람에게 공개되는 것을 확인했어요.</label><small>등록 시각을 표시해요. 사진의 위치 메타데이터는 제거해요.</small></div>
      {!image&&!body.trim()&&<p className="submit-guide">사진을 촬영하거나 이야기를 한 줄 남겨주세요.</p>}
      <Button className="primary-button submit-record" disabled={!ready}><MapPin size={18}/>{pending?'기록을 저장하는 중…':uploading?'사진을 올리는 중…':'이 위치에 공개하기'}<ArrowUpRight size={18}/></Button>
    </form>
  </DialogContent></Dialog></>;
}
