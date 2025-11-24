import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/lib/supabase/server';

export type NotificationType = 'recurring_due' | 'recurring_logged' | 'budget_threshold';

const EMAIL_WEBHOOK = process.env.NOTIFICATION_EMAIL_WEBHOOK;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

async function sendNotificationEmail(to: string | null | undefined, subject: string, body: string) {
  if (!to) return;

  // Primary: Resend
  if (RESEND_API_KEY && RESEND_FROM_EMAIL) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: [to],
          subject,
          text: body,
        }),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[notifications] Resend failed', response.status, errorBody);
      }
      return;
    } catch (error) {
      console.error('[notifications] Resend error', error);
    }
  }

  // Fallback: generic webhook if configured
  if (EMAIL_WEBHOOK) {
    try {
      await fetch(EMAIL_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: to, subject, body }),
      });
    } catch (error) {
      console.error('[notifications] email webhook failed', error);
    }
  }
}

export async function insertNotification(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: {
    title: string;
    body?: string;
    type: NotificationType;
    referenceId?: string | null;
    metadata?: Json | null;
    sendEmail?: boolean;
    userEmail?: string | null;
  },
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    title: params.title,
    body: params.body ?? null,
    type: params.type,
    reference_id: params.referenceId ?? null,
    metadata: params.metadata ?? null,
  });

  if (params.sendEmail) {
    await sendNotificationEmail(params.userEmail, params.title, params.body ?? '');
  }
}

export async function markNotificationsAsRead(
  supabase: SupabaseClient<Database>,
  userId: string,
  referenceId: string,
) {
  await supabase
    .from('notifications')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('reference_id', referenceId)
    .eq('type', 'recurring_due')
    .eq('status', 'unread');
}
