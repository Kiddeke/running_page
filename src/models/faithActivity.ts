// Shared with running-faith-mobile's src/models/faithActivity.ts — keep both
// in sync, since they describe the same Supabase table.
export type FaithType =
  | 'mass'
  | 'confession'
  | 'prayer'
  | 'almsgiving'
  | 'fasting';

export interface FaithActivity {
  id: string;
  type: FaithType;
  date: string; // YYYY-MM-DD
  notes?: string;
}

export const FAITH_TYPES: { key: FaithType; label: string; emoji: string }[] = [
  { key: 'mass', label: 'Mass', emoji: '✝️' },
  { key: 'confession', label: 'Confession', emoji: '🙏' },
  { key: 'prayer', label: 'Prayer', emoji: '📿' },
  { key: 'almsgiving', label: 'Almsgiving', emoji: '🤲' },
  { key: 'fasting', label: 'Fasting', emoji: '🌿' },
];
