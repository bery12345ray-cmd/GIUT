'use client';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {useSession} from 'next-auth/react';
import {toast} from 'sonner';
import {apiRequest} from '@/lib/api-client';
import type {Collections} from '@/lib/collections';
export function useCollections(enabled=true){const {data:session,status}=useSession();return useQuery<Collections>({queryKey:['collections',session?.user?.id||'guest'],queryFn:({signal})=>apiRequest('/api/collections',undefined,signal),enabled:enabled&&status!=='loading',staleTime:15000});}
export function useCollectionActions(){const client=useQueryClient();return useMutation({mutationFn:(body:unknown)=>apiRequest<{ok:true;id?:string}>('/api/collections',body),onSuccess:()=>Promise.all([client.invalidateQueries({queryKey:['collections']}),client.invalidateQueries({queryKey:['spotmap']}),client.invalidateQueries({queryKey:['me']}),client.invalidateQueries({queryKey:['course-detail']})]),onError:e=>toast.error(e.message)});}
