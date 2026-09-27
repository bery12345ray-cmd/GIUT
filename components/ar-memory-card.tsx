'use client';
import {ChevronLeft,Ellipsis,MessageCircle,Bookmark,Heart} from 'lucide-react';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import SpotShare from '@/components/spot-share';
import type {Spot} from '@/lib/model';

export default function ARMemoryCard({spot,distance,onOpen,onDismiss}:{spot:Spot;distance:number;onOpen:()=>void;onDismiss:()=>void}) {
  return <article className="ar-memory-card" aria-label={`${spot.nickname}님의 AR 메모`}>
    <header className="ar-memory-header">
      <button type="button" className="ar-memory-icon" onClick={onDismiss} aria-label="메모 접기"><ChevronLeft size={23}/></button>
      <strong className="ar-memory-author">{spot.nickname}</strong>
      <SpotShare spot={spot} className="ar-memory-icon"/>
      <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="ar-memory-icon" aria-label="메모 더 보기"><Ellipsis size={21}/></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="ar-memory-menu">
          <DropdownMenuItem onSelect={onOpen}>사진·이야기·댓글 보기</DropdownMenuItem>
          <DropdownMenuItem onSelect={onDismiss}>메모 접기</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
    <button type="button" className="ar-memory-main" onClick={onOpen} aria-label={`${spot.title} 사진과 이야기 보기`}>
      {spot.image&&<img className="ar-memory-photo" src={spot.image} alt={spot.title}/>}
      <h2>{spot.title}</h2><p>{spot.body}</p>
    </button>
    <footer className="ar-memory-footer">
      <span>{spot.example?'예시 기록 · ':''}<time dateTime={spot.createdAt}>{new Date(spot.createdAt).toLocaleDateString('ko-KR',{month:'long',day:'numeric',timeZone:'Asia/Seoul'})}</time> · 약 {Math.round(distance)}m</span>
      <button type="button" onClick={onOpen} aria-label="좋아요, 저장, 댓글 보기"><Heart size={15}/>{spot.likes}<Bookmark size={15}/>{spot.saves}<MessageCircle size={15}/>{spot.comments}</button>
    </footer>
  </article>;
}
