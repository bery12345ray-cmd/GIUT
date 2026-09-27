import {z} from 'zod';
export const recordPoint=z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)});
export const createRecordSchema=z.object({
  title:z.string().trim().max(80).default(''),body:z.string().trim().max(2000).default(''),
  category:z.enum(['사진 스팟','산책','러닝','카페','맛집']).default('사진 스팟'),
  lat:recordPoint.shape.lat,lng:recordPoint.shape.lng,location:z.string().trim().min(1).max(150),
  image:z.string().nullable(),ar:z.boolean().optional().transform(()=>true),route:z.array(recordPoint).max(1000).default([]),
  sourceSpotId:z.string().min(1).max(100).optional(),
  publicConsent:z.literal(true,{errorMap:()=>({message:'기록과 위치가 공개되는 것을 확인해주세요.'})}),
}).refine(s=>!!s.body||!!s.image,{message:'사진 한 장 또는 이야기를 남겨주세요.'});

export function recordTitle(record:{title:string;body:string;location:string}) {
  return record.title || record.body.split('\n')[0].slice(0,80) || record.location.slice(0,80);
}
