'use client';
import {useQuery} from '@tanstack/react-query';
import {useSession} from 'next-auth/react';
import {apiRequest} from '@/lib/api-client';
import type {UserWorkspace} from '@/lib/user-workspace';

export function useMyWorkspace() {
  const {data: session, status} = useSession();
  const userId = session?.user?.id;
  return useQuery<UserWorkspace>({
    queryKey: ['me', userId || 'guest'],
    enabled: status === 'authenticated' && !!userId,
    queryFn: ({signal}) => apiRequest<UserWorkspace>('/api/me', undefined, signal),
    staleTime: 15000,
    refetchInterval: 30000,
    // Intentionally no placeholderData/keepPreviousData across different users.
  });
}
