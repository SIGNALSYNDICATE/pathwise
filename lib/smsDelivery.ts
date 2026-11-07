import type { SupabaseClient } from '@supabase/supabase-js'
import { isDeliverableMobile } from '@/lib/phone'
import { SmsDeliveryError, sendSms } from '@/lib/sms'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type SmsAlert = {
  notification_id: string
  phone_e164: string
  message: string
}

export function asSmsAlert(value: unknown): SmsAlert | null {
  if (!value || typeof value !== 'object') return null
  const alert = value as Partial<SmsAlert>
  if (typeof alert.notification_id !== 'string' || !UUID.test(alert.notification_id)) return null
  if (typeof alert.phone_e164 !== 'string' || !isDeliverableMobile(alert.phone_e164)) return null
  if (typeof alert.message !== 'string') return null
  if (!alert.message.startsWith('Pathwise: ') || alert.message.length > 480) return null
  return {
    notification_id: alert.notification_id,
    phone_e164: alert.phone_e164,
    message: alert.message,
  }
}

async function finalize(
  supabase: SupabaseClient,
  secret: string,
  notificationId: string,
  status: 'sent' | 'failed',
  providerRef: string | null
) {
  const { error } = await supabase.rpc('finalize_sms_notification', {
    p_notification_id: notificationId,
    p_dispatch_secret: secret,
    p_status: status,
    p_provider_ref: providerRef,
  })
  if (error) {
    console.error('SMS status update failed:', error.code ?? 'unknown')
  }
}

export async function deliverAlert(
  supabase: SupabaseClient,
  secret: string,
  alert: SmsAlert
): Promise<boolean> {
  try {
    const receipt = await sendSms(alert.phone_e164, alert.message)
    await finalize(supabase, secret, alert.notification_id, 'sent', receipt.transactionId)
    return true
  } catch (error) {
    const status = error instanceof SmsDeliveryError ? error.providerStatus : null
    console.error('SMS send failed:', status ?? 'unavailable')
    await finalize(supabase, secret, alert.notification_id, 'failed', null)
    return false
  }
}
