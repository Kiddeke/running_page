import { useCallback, useEffect, useState } from 'react';
import type { FaithActivity } from '@/models/faithActivity';
import {
  faithActivityRepository,
  type FaithActivityRepository,
} from '@/data/faithActivityRepository';

// Mirrors running-faith-mobile's hook of the same name/shape — both wrap the
// same kind of FaithActivityRepository so the two apps' Faith UIs behave
// identically around loading/add/remove, even though the repositories are
// separate instances hitting the same Supabase table.
export const useFaithActivities = (
  repository: FaithActivityRepository = faithActivityRepository
) => {
  const [activities, setActivities] = useState<FaithActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await repository.list();
    setActivities(list);
    setLoading(false);
  }, [repository]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addActivity = useCallback(
    async (activity: Omit<FaithActivity, 'id'>) => {
      await repository.add(activity);
      await refresh();
    },
    [repository, refresh]
  );

  const removeActivity = useCallback(
    async (id: string) => {
      await repository.remove(id);
      await refresh();
    },
    [repository, refresh]
  );

  return { activities, loading, addActivity, removeActivity, refresh };
};
