'use client';
import {useRef,useState} from 'react';
import {Share2,Copy,Check} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {courseShareData} from '@/lib/course-share';
import {shareSpot as shareViaDevice} from '@/lib/spot-share';
import type {Course} from '@/lib/collections';

export default function CourseShare({course}:{course:Course}) {
  const [open,setOpen]=useState(false),[data,setData]=useState<ShareData>({});
  const [copied,setCopied]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const input=useRef<HTMLInputElement>(null);
  async function copy() {
    try{await navigator.clipboard.writeText(data.url!);setCopied(true);setMessage('');}
    catch{input.current?.focus();input.current?.select();setMessage('자동 복사가 안 되면 선택된 링크를 직접 복사해주세요.');}
  }
  async function share() {
    if(busy)return;
    setBusy(true);setMessage('');
    const result=await shareViaDevice(data,navigator);
    if(result==='fallback')setMessage('이 브라우저에서는 앱 공유를 열 수 없어요. 링크를 복사해 카카오톡에 붙여넣어주세요.');
    setBusy(false);
  }
  return <>
    <button type="button" className="outline-button course-share-button" aria-label={`${course.title} 공유하기`} onClick={()=>{setData(courseShareData(course,window.location.origin));setCopied(false);setMessage('');setOpen(true);}}><Share2 size={18}/>공유하기</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="app-dialog course-share-dialog">
      <DialogHeader><DialogTitle>이 코스, 함께 기웃해요.</DialogTitle><DialogDescription>링크를 받은 사람은 로그인 없이 코스와 방문 순서를 볼 수 있어요.</DialogDescription></DialogHeader>
      <strong className="course-share-name">{course.title}</strong>
      <Input ref={input} aria-label="공유할 코스 링크" value={data.url||''} readOnly onFocus={e=>e.target.select()}/>
      <button type="button" className="primary-button" onClick={copy}>{copied?<Check size={18}/>:<Copy size={18}/>} {copied?'링크를 복사했어요':'링크 복사'}</button>
      <button type="button" className="outline-button" onClick={share} disabled={busy}><Share2 size={18}/>{busy?'공유 창 여는 중…':'앱으로 공유하기'}</button>
      <p className="form-note">휴대폰 공유 목록에 카카오톡이 있으면 선택해주세요. 목록에 없으면 링크를 복사해 대화방에 붙여넣을 수 있어요.</p>
      {message&&<p className="course-share-status" role="status">{message}</p>}
      {copied&&<span className="sr-only" role="status">링크를 복사했어요.</span>}
    </DialogContent></Dialog>
  </>;
}
