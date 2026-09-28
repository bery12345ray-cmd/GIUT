'use client';
import {useEffect,useRef,useState,type CSSProperties,type PointerEvent,type ReactNode} from 'react';
import {ChevronDown,ChevronUp,Compass} from 'lucide-react';

export default function ExplorePanel({intro,children,expanded,onExpanded,hidden,onHidden}:{intro:ReactNode;children:ReactNode;expanded:boolean;onExpanded:(v:boolean)=>void;hidden:boolean;onHidden:(v:boolean)=>void}){
  const drag=useRef<{id:number;x:number;y:number;time:number}|null>(null);
  const [offset,setOffset]=useState(0);
  useEffect(()=>{
    const mobile=window.matchMedia('(max-width:760px)');
    const reset=()=>{if(!mobile.matches)onHidden(false);};
    reset();mobile.addEventListener('change',reset);
    return()=>mobile.removeEventListener('change',reset);
  },[onHidden]);
  function end(event:PointerEvent<HTMLElement>,cancelled=false){
    const gesture=drag.current;if(!gesture||gesture.id!==event.pointerId)return;
    const dy=event.clientY-gesture.y,dx=event.clientX-gesture.x;
    if(!cancelled&&dy>Math.abs(dx)&&(dy>72||(dy>28&&dy/Math.max(1,performance.now()-gesture.time)>.55)))onHidden(true);
    if(!cancelled&&dy< -48&&Math.abs(dy)>Math.abs(dx))onExpanded(true);
    drag.current=null;setOffset(0);
  }
  return <>
    <aside className={'explore-panel '+(expanded?'expanded ':'')+(hidden?'is-hidden ':'')+(offset?'is-dragging':'')} aria-label="골목 이야기 패널" inert={hidden} style={{'--panel-drag':`${offset}px`} as CSSProperties}>
      <div className="panel-swipe-zone" onPointerDown={event=>{
        if(!window.matchMedia('(max-width:760px)').matches||event.button!==0||(event.target as Element).closest('button,a,input,select,textarea'))return;
        drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now()};event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={event=>{if(drag.current?.id===event.pointerId)setOffset(Math.max(0,event.clientY-drag.current.y));}} onPointerUp={event=>end(event)} onPointerCancel={event=>end(event,true)}>
        <div className="panel-grab-area"><span className="panel-grab-line"/><button type="button" className="panel-expand-button" aria-label={expanded?'골목 목록 접기':'골목 목록 펼치기'} aria-expanded={expanded} onClick={()=>onExpanded(!expanded)}>{expanded?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</button><button type="button" className="panel-dismiss-button" aria-label="골목 이야기 패널 숨기기" onClick={()=>onHidden(true)}><ChevronDown size={20}/></button></div>
        {intro}
      </div>
      <div className="panel-content">{children}</div>
    </aside>
    {hidden&&<button type="button" className="panel-reopen" onClick={()=>{onExpanded(false);onHidden(false);}}><Compass size={17}/>골목 이야기 펼치기</button>}
  </>;
}
