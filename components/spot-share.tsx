'use client';
import {useRef,useState} from 'react';
import {Share2,Copy,Check} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {shareSpot,spotShareData} from '@/lib/spot-share';
import type {Spot} from '@/lib/model';

export default function SpotShare({spot,className='',label=false}:{spot:Spot;className?:string;label?:boolean}) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[url,setURL]=useState('');
  const [copied,setCopied]=useState(false),[copyError,setCopyError]=useState('');
  const input=useRef<HTMLInputElement>(null);
  async function share() {
    if(busy)return;
    setBusy(true);
    const data=spotShareData(spot,window.location.origin);
    const result=await shareSpot(data,navigator);
    if(result==='fallback'){setURL(data.url!);setCopied(false);setCopyError('');setOpen(true);}
    setBusy(false);
  }
  async function copy() {
    try{await navigator.clipboard.writeText(url);setCopied(true);setCopyError('');}
    catch{input.current?.select();setCopyError('링크를 길게 눌러 복사한 뒤 SNS에 붙여넣어주세요.');}
  }
  return <>
    <button type="button" className={className} aria-label={`${spot.title} 공유하기`} disabled={busy} onClick={share}><Share2 size={21}/>{label&&'공유하기'}</button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="app-dialog spot-share-dialog">
      <DialogHeader><DialogTitle>이 골목, 함께 볼까요?</DialogTitle><DialogDescription>링크를 복사해 SNS나 채팅방에 보내세요.</DialogDescription></DialogHeader>
      <p className="spot-share-title">{spot.title}</p>
      <Input ref={input} aria-label="공유할 장소 링크" readOnly value={url} onFocus={e=>e.target.select()}/>
      <button type="button" className="primary-button" onClick={copy}>{copied?<Check size={19}/>:<Copy size={19}/>} {copied?'링크를 복사했어요':'링크 복사'}</button>
      {copyError&&<p role="status">{copyError}</p>}
      <p className="form-note">이 사이트에 접근 권한이 있는 사람이 기록을 볼 수 있어요.</p>
    </DialogContent></Dialog>
  </>;
}
