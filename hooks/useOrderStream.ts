import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Order {
  id: string;
  platformOrderId: string;
  displayOrderId: string;
  status: string;
  customerName: string;
  items: any[];
  total: number;
  placedAt: string;
  etaMins: number;
  notes?: string;
}

interface UseOrderStreamOptions {
  tenantId: string;
  onNewOrder?: (order: Order) => void;
  onOrderUpdated?: (order: Order) => void;
  onOrderCancelled?: (order: Order) => void;
}

export function useOrderStream(options: UseOrderStreamOptions) {
  const { tenantId, onNewOrder, onOrderUpdated, onOrderCancelled } = options;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;

    // Get WebSocket URL from environment
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    const socketInstance = io(`${wsUrl}/orders`, {
      auth: { tenantId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketInstance.on('connect', () => {
      console.log('[useOrderStream] Connected to WebSocket');
      setConnected(true);
      setError(null);
    });

    socketInstance.on('disconnect', () => {
      console.log('[useOrderStream] Disconnected from WebSocket');
      setConnected(false);
    });

    socketInstance.on('connect_error', (err: Error) => {
      console.error('[useOrderStream] Connection error:', err);
      setError(err.message);
      setConnected(false);
    });

    // Subscribe to order events
    socketInstance.on('order:new', (order: Order) => {
      console.log('[useOrderStream] New order received:', order);
      onNewOrder?.(order);
      
      // Play sound notification
      playNotificationSound();
      
      // Show desktop notification
      showDesktopNotification('New Order', `Order #${order.displayOrderId} from ${order.customerName}`);
    });

    socketInstance.on('order:updated', (order: Order) => {
      console.log('[useOrderStream] Order updated:', order);
      onOrderUpdated?.(order);
    });

    socketInstance.on('order:cancelled', (order: Order) => {
      console.log('[useOrderStream] Order cancelled:', order);
      onOrderCancelled?.(order);
      
      // Show desktop notification
      showDesktopNotification('Order Cancelled', `Order #${order.displayOrderId} has been cancelled`);
    });

    setSocket(socketInstance);

    return () => {
      console.log('[useOrderStream] Cleaning up socket connection');
      socketInstance.disconnect();
    };
  }, [tenantId, onNewOrder, onOrderUpdated, onOrderCancelled]);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/sounds/order-notification.mp3');
      audio.play().catch((err) => {
        console.warn('[useOrderStream] Failed to play notification sound:', err);
      });
    } catch (err) {
      console.warn('[useOrderStream] Failed to create audio element:', err);
    }
  }, []);

  const showDesktopNotification = useCallback((title: string, body: string) => {
    if (!('Notification' in window)) {
      console.warn('[useOrderStream] Desktop notifications not supported');
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `order-${Date.now()}`,
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `order-${Date.now()}`,
          });
        }
      });
    }
  }, []);

  const requestNotificationPermission = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return {
    connected,
    error,
    requestNotificationPermission,
  };
}

export type { Order };