import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

/**
 * Initialize push notifications on native platforms.
 * Call this after the admin logs in.
 */
export async function initPushNotifications() {
  // Only run on native platforms (iOS/Android)
  if (!Capacitor.isNativePlatform()) {
    console.log('[Push] Not a native platform, skipping');
    return;
  }

  try {
    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('[Push] Permission not granted');
      return;
    }

    // Register for push notifications
    await PushNotifications.register();

    // Listen for registration success
    PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] Token received:', token.value);
      await saveDeviceToken(token.value);
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Registration error:', error);
    });

    // Handle notification received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Notification received:', notification);
      // The app already handles in-app notifications via realtime,
      // so we just log here. The native notification will show automatically.
    });

    // Handle notification tap (app opened from notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Notification tapped:', action);
      const data = action.notification.data;
      if (data?.type === 'new_order') {
        // Navigate to orders page
        window.location.href = '/admin/pedidos';
      }
    });

    console.log('[Push] Initialized successfully');
  } catch (e) {
    console.error('[Push] Init error:', e);
  }
}

/**
 * Save device token to the database
 */
async function saveDeviceToken(token: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[Push] No user logged in, cannot save token');
      return;
    }

    const platform = Capacitor.getPlatform(); // 'ios' or 'android'

    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        { user_id: user.id, token, platform, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      );

    if (error) {
      console.error('[Push] Failed to save token:', error);
    } else {
      console.log('[Push] Token saved successfully');
    }
  } catch (e) {
    console.error('[Push] Save token error:', e);
  }
}

/**
 * Remove device token on logout
 */
export async function removePushToken() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('device_tokens')
        .delete()
        .eq('user_id', user.id);
    }
  } catch (e) {
    console.error('[Push] Remove token error:', e);
  }
}
