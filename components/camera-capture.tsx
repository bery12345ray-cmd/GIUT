'use client';
import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react';
import {Camera,LoaderCircle,RotateCcw} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export type CameraCaptureControl={open:()=>void};
export default function CameraCapture({ref,onCapture}:{ref:Ref<CameraCaptureControl>;onCapture:(photo:File)=>Promise<void>}){
  const [open,setOpen]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState(false),[capturing,setCapturing]=useState(false);
  const [media,setMedia]=useState<MediaStream|null>(null);
  const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),generation=useRef(0);
  function release(){generation.current++;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;}
  function close(){release();setOpen(false);setMedia(null);setReady(false);setCapturing(false);}
  function start(){
    release();const id=generation.current;setOpen(true);setError('');setReady(false);setCapturing(false);setMedia(null);
    if(!navigator.mediaDevices?.getUserMedia){setError('카메라를 사용할 수 없어요. Safari나 Chrome에서 사이트를 직접 열어주세요.');return;}
    // Start capture directly from the photo button, without a file picker.
    void navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1440}},audio:false}).then(s=>{
      if(generation.current!==id){s.getTracks().forEach(t=>t.stop());return;}
      stream.current=s;setMedia(s);
    }).catch(()=>{if(generation.current===id)setError('카메라에 연결하지 못했어요. 카메라 권한을 허용하고 다시 시도해주세요.');});
  }
  useImperativeHandle(ref,()=>({open:start}));
  useEffect(()=>{
    const el=video.current;if(!el||!media)return;
    const id=generation.current;
    el.srcObject=media;void el.play().catch(()=>{if(id===generation.current)setError('카메라 재생을 다시 시도해주세요.');});
    return()=>{el.srcObject=null;};
  },[media]);
  useEffect(()=>{
    const hidden=()=>{if(document.hidden)close();};
    document.addEventListener('visibilitychange',hidden);
    return()=>{release();document.removeEventListener('visibilitychange',hidden);};
  },[]);
  async function capture(){
    const el=video.current;if(!el||!ready||capturing||!el.videoWidth)return;
    const id=generation.current;setCapturing(true);
    try{
      const canvas=document.createElement('canvas');const scale=Math.min(1,1800/Math.max(el.videoWidth,el.videoHeight));
      canvas.width=Math.round(el.videoWidth*scale);canvas.height=Math.round(el.videoHeight*scale);
      canvas.getContext('2d')!.drawImage(el,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('사진을 촬영하지 못했어요. 다시 시도해주세요.')),'image/jpeg',.9));
      if(id!==generation.current)return;
      close();await onCapture(new File([blob],'giut-moment.jpg',{type:'image/jpeg'}));
    }catch(e){if(id===generation.current){setError(e instanceof Error?e.message:'다시 촬영해주세요.');setCapturing(false);}}
  }
  return <Dialog open={open} onOpenChange={v=>{if(!v)close();}}><DialogContent className="capture-dialog">
    <DialogHeader><DialogTitle>지금, 이 순간 담기</DialogTitle><DialogDescription>눈앞의 작은 발견을 사진으로 남겨보세요.</DialogDescription></DialogHeader>
    <div className="capture-viewfinder"><video ref={video} muted playsInline autoPlay onPlaying={()=>setReady(true)}/>
      {!ready&&!error&&<div className="capture-state" role="status"><LoaderCircle className="spin"/>카메라를 연결하고 있어요.</div>}
      {error&&<div className="capture-state" role="alert"><Camera/><p>{error}</p><button type="button" className="ar-glass" onClick={start}><RotateCcw size={17}/>다시 연결</button></div>}
    </div>
    <div className="capture-actions"><p>필터 없이, 있는 그대로.</p><button type="button" className="camera-shutter" aria-label="사진 촬영" disabled={!ready||!!error||capturing} onClick={()=>void capture()}>{capturing?<LoaderCircle className="spin"/>:<Camera size={26}/>}</button><button type="button" className="text-button" onClick={close}>취소</button></div>
  </DialogContent></Dialog>;
}
