import { useCallback, useEffect, useRef } from 'react';

export function useOrderSoundNotification(
  enabled: boolean,
  newOrdersCount: number,
  previousOrdersCount: number
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasShownAlertRef = useRef(false);
  const lastAlertTimeRef = useRef<number>(0);

  // Initialize audio element on mount
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Create a notification sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880; // A5 note
      gainNode.gain.value = 0.3;

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Store oscillator reference for playback
      (audioRef as any).current = { oscillator, gainNode, context: audioContext };
    } catch (error) {
      console.error('Failed to initialize audio notification:', error);
    }
  }, [enabled]);

  // Play sound when new order arrives
  useEffect(() => {
    if (!enabled || newOrdersCount <= previousOrdersCount) return;

    const now = Date.now();
    // Debounce: only alert if at least 2 seconds have passed since last alert
    if (now - lastAlertTimeRef.current < 2000) return;

    lastAlertTimeRef.current = now;

    // Play notification sound
    const audioData = audioRef.current as any;
    if (audioData?.context && audioData.oscillator) {
      try {
        const oscillator = audioData.oscillator;
        const gainNode = audioData.gainNode;
        const context = audioData.context;

        // Play a beep pattern: beep-beep (like delivery notification)
        const now = context.currentTime;
        oscillator.frequency.setValueAtTime(880, now);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.setValueAtTime(0, now + 0.15);
        gainNode.gain.setValueAtTime(0.3, now + 0.3);
        gainNode.gain.setValueAtTime(0, now + 0.45);

        // Resume context if suspended
        if (context.state === 'suspended') {
          context.resume();
        }
      } catch (error) {
        console.error('Failed to play notification sound:', error);
      }
    }

    // Also try browser notification API
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('New Order Received', {
          body: `You have ${newOrdersCount - previousOrdersCount} new order(s)`,
          icon: '/icon-192.png',
          tag: 'new-order',
        });
      } catch (error) {
        console.error('Failed to show browser notification:', error);
      }
    }

    // Show toast alert if not recently shown
    if (!hasShownAlertRef.current) {
      hasShownAlertRef.current = true;
      // Reset flag after 3 seconds
      setTimeout(() => {
        hasShownAlertRef.current = false;
      }, 3000);
    }
  }, [enabled, newOrdersCount, previousOrdersCount]);

  // Clean up on unmount
  useEffect(() => {
    const audioData = audioRef.current as any;
    if (audioData?.context) {
      audioData.context.close();
    }
  }, []);

  return {
    playManualAlert: useCallback(() => {
      lastAlertTimeRef.current = 0; // Reset to force next alert
      const now = Date.now();
      lastAlertTimeRef.current = now - 2001; // Force trigger
    }, []),
  };
}

export type OrderPriority = 'urgent' | 'high' | 'normal' | 'low';

export function getOrderPriority(order: {
  status: string;
  placedAt: string;
  amount: number;
  etaMins: number;
}): OrderPriority {
  const minutesSincePlacement = (Date.now() - new Date(order.placedAt).getTime()) / (1000 * 60);
  const isCancelled = order.status === 'cancelled';
  const isCompleted = order.status === 'completed';

  // Cancelled or completed orders have no priority
  if (isCancelled || isCompleted) return 'low';

  // Priority based on urgency (time since placement + ETA)
  const urgencyScore = minutesSincePlacement + (order.etaMins || 0);

  // Adjust by order value (higher value = higher priority)
  const valueScore = order.amount / 10;

  const totalScore = urgencyScore - valueScore;

  if (totalScore > 45) return 'urgent'; // Over 45 mins or high value order
  if (totalScore > 30) return 'high';  // Over 30 mins
  if (totalScore > 15) return 'normal'; // Over 15 mins
  return 'low'; // Under 15 mins
}

export function getPriorityColor(priority: OrderPriority): string {
  switch (priority) {
    case 'urgent':
      return 'border-red-500/30 bg-red-500/10 text-red-300';
    case 'high':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-300';
    case 'normal':
      return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300';
    case 'low':
    default:
      return 'border-zinc-700 bg-zinc-800/50 text-zinc-400';
  }
}

export function getPriorityLabel(priority: OrderPriority): string {
  switch (priority) {
    case 'urgent':
      return '!';
    case 'high':
      return '!!';
    default:
      return '';
  }
}
