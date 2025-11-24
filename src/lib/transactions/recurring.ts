'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/server';
import { insertNotification, markNotificationsAsRead } from '@/lib/notifications';

type RecurringRow = {
  id: string;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  payment_method: string;
  notes: string | null;
  category_id: string | null;
  account_id: string | null;
  auto_log: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  next_run_on: string;
};

function addPeriod(dateString: string, frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  if (frequency === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (frequency === 'monthly') {
    const originalDay = date.getDate();
    date.setMonth(date.getMonth() + 1);
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(originalDay, lastDayOfMonth));
  } else {
    const month = date.getMonth();
    const day = date.getDate();
    date.setFullYear(date.getFullYear() + 1);
    const lastDayOfMonth = new Date(date.getFullYear(), month + 1, 0).getDate();
    date.setMonth(month);
    date.setDate(Math.min(day, lastDayOfMonth));
  }
  return date.toISOString().slice(0, 10);
}

export async function processRecurringSchedules(
  supabase: SupabaseClient<Database>,
  userId: string,
  currencyCode: string,
  userEmail?: string | null,
): Promise<RecurringRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select(
      'id, name, amount, type, payment_method, notes, category_id, account_id, auto_log, frequency, next_run_on',
    )
    .eq('user_id', userId)
    .lte('next_run_on', today);

  if (error || !data) {
    return [];
  }

  const reminders: RecurringRow[] = [];
  for (const rule of data) {
    if (!rule.auto_log) {
      const { data: existingDue } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('reference_id', rule.id)
        .eq('type', 'recurring_due')
        .eq('status', 'unread')
        .maybeSingle();
      if (!existingDue) {
        await insertNotification(supabase, userId, {
          title: `Recurring transaction due`,
          body: `${rule.name} is due on ${new Date(rule.next_run_on).toLocaleDateString('en-US')}`,
          type: 'recurring_due',
          referenceId: rule.id,
          sendEmail: true,
          userEmail,
        });
      }
      reminders.push(rule as RecurringRow);
      continue;
    }
    let nextRun = rule.next_run_on;
    // Log as many missed occurrences as needed
    while (nextRun <= today) {
      await supabase.from('transactions').insert({
        user_id: userId,
        amount: rule.amount,
        type: rule.type,
        category_id: rule.category_id,
        account_id: rule.account_id,
        payment_method: rule.payment_method,
        notes: rule.notes,
        payee: rule.name,
        occurred_on: nextRun,
        currency_code: currencyCode,
        recurring_transaction_id: rule.id,
      });
      await insertNotification(supabase, userId, {
        title: `Recurring transaction logged`,
        body: `${rule.name} logged for ${new Date(nextRun).toLocaleDateString('en-US')}`,
        type: 'recurring_logged',
        referenceId: rule.id,
        sendEmail: true,
        userEmail,
      });
      nextRun = addPeriod(nextRun, rule.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly');
    }
    await supabase
      .from('recurring_transactions')
      .update({ next_run_on: nextRun, updated_at: new Date().toISOString() })
      .eq('id', rule.id)
      .eq('user_id', userId);
    await markNotificationsAsRead(supabase, userId, rule.id);
  }
  return reminders;
}
