import type {Course} from './collections';
export function courseShareData(course:Pick<Course,'id'|'title'|'nickname'>,origin:string):ShareData {
  const url=new URL('/',origin);
  url.searchParams.set('course',course.id);
  return {title:`${course.title} · 기웃`,text:`${course.nickname}님의 코스, 같이 기웃해요.`,url:url.href};
}
export function sharedCourseId(search:string) {
  const id=new URLSearchParams(search).get('course');
  return id&&/^[a-zA-Z0-9_-]{1,180}$/.test(id)?id:null;
}
