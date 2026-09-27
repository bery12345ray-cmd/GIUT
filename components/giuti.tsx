'use client';

import {useEffect,useRef} from 'react';
import {gsap} from 'gsap';

// Cropped from the user's transparent character sheet. Preserve its original artwork.
const poses=['idle','happy','wink','curious','explore','wave','love','sleep','stretch'] as const;
export type CatPose=typeof poses[number];

function animatePose(el:HTMLImageElement,pose:CatPose){
 const timeline=gsap.timeline({repeat:-1,repeatDelay:pose==='sleep'?1.2:3.4,defaults:{ease:'sine.inOut'}});
 switch(pose){
  case 'explore':
   // A short walking sway, relative to the character's rendered size.
   for(let step=0;step<2;step++)timeline
    .to(el,{xPercent:2,yPercent:-2.5,rotation:2.5,duration:.28})
    .to(el,{xPercent:-2,yPercent:0,rotation:-2.5,duration:.28});
   timeline.to(el,{xPercent:0,rotation:0,duration:.3});
   break;
  case 'happy':
  case 'wave':
   timeline.to(el,{yPercent:-7,rotation:-5,duration:.32,ease:'power2.out'})
    .to(el,{yPercent:0,rotation:3,duration:.42,ease:'bounce.out'})
    .to(el,{rotation:0,duration:.3});
   break;
  case 'curious':
   timeline.to(el,{rotation:-6,xPercent:-2,duration:.6})
    .to(el,{rotation:4,xPercent:2,duration:.8})
    .to(el,{rotation:0,xPercent:0,duration:.6});
   break;
  case 'love':
   timeline.to(el,{rotation:-4,yPercent:-3,duration:.65})
    .to(el,{rotation:4,yPercent:-2,duration:.8})
    .to(el,{rotation:0,yPercent:0,duration:.65});
   break;
  case 'sleep':
   timeline.to(el,{yPercent:-1.5,duration:1.8}).to(el,{yPercent:0,duration:1.8});
   break;
  case 'stretch':
   timeline.to(el,{xPercent:2,rotation:3,duration:1}).to(el,{xPercent:0,rotation:0,duration:1});
   break;
  default:
   timeline.to(el,{yPercent:-2,rotation:-2,duration:.8}).to(el,{yPercent:0,rotation:0,duration:.9});
 }
 return timeline;
}

export default function Giuti({pose='idle',className='',animated=false,label='골목대장 기웃이'}:{pose?:CatPose;className?:string;animated?:boolean;label?:string}){
 const container=useRef<HTMLSpanElement>(null);
 const artwork=useRef<HTMLImageElement>(null);
 useEffect(()=>{
  const el=artwork.current,host=container.current;
  if(!el||!host||!animated)return;
  const mm=gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)',()=>{
   const timeline=animatePose(el,pose);
   let inView=true;
   const syncVisibility=()=>{timeline.paused(document.hidden||!inView);};
   const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
    inView=entries[0]?.isIntersecting??false;syncVisibility();
   });
   observer?.observe(host);
   document.addEventListener('visibilitychange',syncVisibility);
   syncVisibility();
   return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',syncVisibility);timeline.kill();};
  });
  return()=>mm.revert();
 },[animated,pose]);
 return <span ref={container} className={'giuti '+className} data-pose={pose} role={label?'img':undefined} aria-label={label||undefined} aria-hidden={!label||undefined}>
  <img ref={artwork} className="giuti-art" src={`/giuti/${pose}-v2.png`} width={240} height={272} alt="" draggable={false} decoding="async"/>
 </span>;
}
