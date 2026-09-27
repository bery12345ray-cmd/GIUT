'use client';
import {useQuery} from '@tanstack/react-query';
import {Footprints,ArrowUpRight,Pencil,Trash2,LoaderCircle} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import RouteMap from './route-map';
import CourseShare from './course-share';
import {apiRequest} from '@/lib/api-client';
import type {PublicCourse} from '@/lib/public-course';
import type {Course} from '@/lib/collections';
import type {Spot} from '@/lib/model';

export default function CourseDetail({courseId,kakaoKey,onClose,onOpen,onFollow,onEdit,onDelete,ownerId}:{
  courseId:string;kakaoKey:string;onClose:()=>void;onOpen:(s:Spot)=>void;
  onFollow:(spots:Spot[],title:string,mode?:'walk'|'run')=>void;
  onEdit?:(c:Course)=>void;onDelete?:(c:Course)=>void;ownerId?:string;
}) {
  const query=useQuery<PublicCourse>({queryKey:['course-detail',courseId],queryFn:({signal})=>apiRequest('/api/courses/'+encodeURIComponent(courseId),undefined,signal),staleTime:0});
  const course=query.data?.course,spots=query.data?.spots||[];
  return <Dialog open onOpenChange={o=>{if(!o)onClose();}}><DialogContent className="app-dialog course-detail">
    <DialogHeader><p className="eyebrow">A LITTLE ROUTE TOGETHER</p><DialogTitle>{course?.title||'코스 둘러보기'}</DialogTitle><DialogDescription>{course?`${course.nickname}의 코스 · ${spots.length}곳`:'함께 기웃할 장소와 이야기를 확인해요.'}</DialogDescription></DialogHeader>
    {query.isPending?<p className="collection-loading" role="status"><LoaderCircle className="spin" size={18}/>코스를 불러오는 중…</p>:query.isError?<div className="collection-error" role="alert"><p>{query.error.message}</p><button onClick={()=>query.refetch()}>다시 시도</button><button onClick={onClose}>지도로 돌아가기</button></div>:course&&<>
      <section className="course-story"><h3>코스 이야기</h3><p>{course.description||'아직 코스 이야기가 없어요.'}</p></section>
      <CourseShare course={course}/>
      {spots.length?<><RouteMap spots={spots} kakaoKey={kakaoKey}/><ol className="course-detail-stops">{spots.map((s,i)=><li key={s.id}><button onClick={()=>onOpen(s)}><span className="stop-number">{i+1}</span><span><strong>{s.title}</strong><small>{s.ar?'AR 기록이 있는 장소':s.location}</small></span><ArrowUpRight size={17}/></button></li>)}</ol></>:<p className="form-note">이 코스에 남아 있는 장소가 없어요.</p>}
      {spots.length===1&&<p className="form-note">일부 장소가 삭제되어 현재 남아 있는 장소만 안내해요.</p>}
      <button className="primary-button" disabled={!spots.length} onClick={()=>onFollow(spots,course.title,course.mode)}><Footprints size={19}/>같이 기웃거리기</button>
      <p className="form-note">현재 위치에서 첫 장소로 이동한 뒤, 저장된 순서대로 안내해요.</p>
      {ownerId===course.userId&&onEdit&&<div className="course-owner-actions"><button className="text-button" onClick={()=>onEdit(course)}><Pencil size={15}/>코스 수정</button>{onDelete&&<button className="text-button" onClick={()=>onDelete(course)}><Trash2 size={15}/>삭제</button>}</div>}
    </>}
  </DialogContent></Dialog>;
}
