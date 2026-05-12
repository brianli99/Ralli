import { supabase } from './supabase';
import { Database } from '../types/database.types';

type TableName = keyof Database['public']['Tables'];

const BETA_REQUIRED_TABLES: TableName[] = [
  'app_notifications',
  'push_tokens',
  'notification_preferences',
  'session_waitlist',
  'user_favorites',
  'feed_activities',
  'activity_likes',
  'activity_comments',
  'court_messages',
  'crews',
  'crew_members',
  'crew_challenges',
];

let hasRun = false;

export async function runBetaSchemaDiagnostics() {
  if (hasRun) return;
  hasRun = true;

  const missing: string[] = [];

  await Promise.all(
    BETA_REQUIRED_TABLES.map(async (table) => {
      const { error } = await supabase
        .from(table)
        .select('*', { head: true, count: 'exact' })
        .limit(1);

      if (error) {
        const message = error.message || '';
        if (
          message.includes('does not exist') ||
          message.includes('schema cache') ||
          error.code === '42P01' ||
          error.code === 'PGRST205'
        ) {
          missing.push(table);
        }
      }
    })
  );

  if (missing.length > 0) {
    console.warn(
      `Ralli beta schema is missing required tables: ${missing.join(', ')}. ` +
        'Run sql/beta-schema-consolidated.sql in Supabase before beta testing.'
    );
  }
}
