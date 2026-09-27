'use client';

import {useEffect,type RefObject} from 'react';
import {gsap} from 'gsap';

export function useGiutMotion(root:RefObject<HTMLDivElement|null>,tab:string,listKey:string){
 useEffect(()=>{
  const el=root.current;if(!el)return;
  const mm=gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)',()=>{
   const context=gsap.context(()=>{
    const items=el.querySelectorAll('.explore-heading,.search-box,.category-chips,.mascot-guide,.page-heading,.profile-cover,.ar-intro > *');
    gsap.fromTo(items,{y:18,opacity:0},{y:0,opacity:1,duration:.7,stagger:.055,ease:'power3.out',clearProps:'transform,opacity'});
   },el);
   return()=>context.revert();
  });
  return()=>mm.revert();
 },[root,tab]);

 useEffect(()=>{
  const el=root.current;if(!el)return;
  const mm=gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)',()=>{
   const context=gsap.context(()=>{
    const cards=el.querySelectorAll('.spot-card,.badge-card');
    gsap.fromTo(cards,{y:20,opacity:0},{y:0,opacity:1,stagger:{each:.045,amount:Math.min(cards.length*.045,.3)},duration:.5,ease:'power2.out',clearProps:'transform,opacity'});
   },el);
   return()=>context.revert();
  });
  return()=>mm.revert();
 },[root,tab,listKey]);

 useEffect(()=>{
  const nav=root.current?.querySelector<HTMLElement>('.main-nav');
  const indicator=nav?.querySelector<HTMLElement>('.nav-indicator');
  if(!nav||!indicator)return;
  let disposed=false;
  const move=()=>{
   if(disposed)return;
   const active=nav.querySelector<HTMLElement>('[data-slot=tabs-trigger][data-state=active]');if(!active)return;
   gsap.to(indicator,{x:active.offsetLeft,y:active.offsetTop,width:active.offsetWidth,height:active.offsetHeight,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:.45,ease:'power3.out',overwrite:true});
  };
  move();const observer=new ResizeObserver(move);observer.observe(nav);
  document.fonts.ready.then(move);
  return()=>{disposed=true;observer.disconnect();gsap.killTweensOf(indicator);};
 },[root,tab]);

 useEffect(()=>{
  const mm=gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)',()=>{
   const tweens=new Set<gsap.core.Tween>();
   const animate=(el:Element,vars:gsap.TweenVars)=>{const tween=gsap.to(el,{...vars,onComplete:()=>tweens.delete(tween)});tweens.add(tween);};
   const over=(event:PointerEvent)=>{
    if(event.pointerType!=='mouse')return;
    const card=(event.target as Element)?.closest<HTMLElement>('.spot-card,.badge-card');
    if(card&&!card.contains(event.relatedTarget as Node|null))animate(card,{y:-4,duration:.3,ease:'power2.out',overwrite:true});
   };
   const out=(event:PointerEvent)=>{
    const card=(event.target as Element)?.closest<HTMLElement>('.spot-card,.badge-card');
    if(card&&!card.contains(event.relatedTarget as Node|null))animate(card,{y:0,duration:.4,ease:'power3.out',overwrite:true});
   };
   const press=(event:MouseEvent)=>{
    const target=(event.target as Element)?.closest<HTMLButtonElement>('.card-save,.detail-actions button,.category-chips button,.record-fab,.primary-button,.lime-button');
    if(!target||target.disabled)return;
    const content=target.querySelector('svg')||target;
    const tween=gsap.fromTo(content,{scale:.84},{scale:1,duration:.5,ease:'back.out(3)',overwrite:true,onComplete:()=>tweens.delete(tween)});tweens.add(tween);
   };
   document.addEventListener('pointerover',over);document.addEventListener('pointerout',out);document.addEventListener('click',press);
   return()=>{document.removeEventListener('pointerover',over);document.removeEventListener('pointerout',out);document.removeEventListener('click',press);tweens.forEach(t=>t.kill());};
  });
  return()=>mm.revert();
 },[]);
}
