import { queryClient } from '@/lib/queryClient';

export type CacheInvalidationType = 'task' | 'reminder' | 'project' | 'all';

export function invalidateAIMagicQueries(type: CacheInvalidationType) {
  switch (type) {
    case 'task':
      queryClient.invalidateQueries({ 
        predicate: q => 
          typeof q.queryKey[0] === 'string' && 
          q.queryKey[0].includes('internal-task')
      });
      break;
    case 'reminder':
      queryClient.invalidateQueries({ 
        predicate: q => 
          typeof q.queryKey[0] === 'string' && 
          (q.queryKey[0].includes('reminder') || q.queryKey[0].includes('internal-task'))
      });
      break;
    case 'project':
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      break;
    case 'all':
      invalidateAIMagicQueries('task');
      invalidateAIMagicQueries('reminder');
      invalidateAIMagicQueries('project');
      break;
  }
}

export function useAIMagicActions() {
  return {
    invalidateQueries: invalidateAIMagicQueries,
  };
}
