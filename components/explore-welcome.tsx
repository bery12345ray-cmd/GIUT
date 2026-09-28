'use client';
import {ArrowRight,LocateFixed,LoaderCircle} from 'lucide-react';
import Giuti from './giuti';

export function ExploreWelcome({onNearby,busy}:{onNearby:()=>void;busy:boolean}) {
  return <section className="explore-start" aria-label="기웃 시작 안내">
    <p className="eyebrow">A LITTLE LOCAL DISCOVERY</p>
    <h1>기웃기웃...</h1>
    <p>가까운 사진과 메모를 찾고 <br/>당신의 작은 발견도 남겨보세요.</p>
    <Giuti pose="explore" animated className="welcome-cat"/>
    <button className="primary-button" disabled={busy} onClick={onNearby}>{busy?<LoaderCircle size={17} className="spin"/>:<LocateFixed size={17}/>}내 주변 둘러보기<ArrowRight size={17}/></button>
  </section>;
}
