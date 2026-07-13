import { supabase } from '@/lib/supabase';
import type { FaithActivity } from '@/models/faithActivity';

// user_id defaults to auth.uid() server-side (see supabase/schema.sql), so
// inserts don't need to look up or pass the current user explicitly — RLS
// rejects any insert made while signed out, since auth.uid() is null then.
// Mirrors running-faith-mobile's FaithActivityRepository so both apps read
// and write the same shape against the same table.
export interface FaithActivityRepository {
  list(): Promise<FaithActivity[]>;
  add(activity: Omit<FaithActivity, 'id'>): Promise<void>;
  remove(id: string): Promise<void>;
}

export class SupabaseFaithActivityRepository implements FaithActivityRepository {
  async list(): Promise<FaithActivity[]> {
    const { data, error } = await supabase
      .from('faith_activities')
      .select('id, type, date, notes')
      .order('date', { ascending: false });

    if (error) throw error;
    return (data ?? []) as FaithActivity[];
  }

  async add(activity: Omit<FaithActivity, 'id'>): Promise<void> {
    const { error } = await supabase.from('faith_activities').insert({
      type: activity.type,
      date: activity.date,
      notes: activity.notes ?? null,
    });

    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('faith_activities')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}

export const faithActivityRepository: FaithActivityRepository =
  new SupabaseFaithActivityRepository();
