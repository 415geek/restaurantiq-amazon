import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

type OrderEvent = {
  id: string;
  displayOrderId: string;
  platform: string;
  status: string;
  customerName: string;
  amount: number;
  items: string[];
  placedAt: string;
  etaMins: number;
};

type OrderStreamHook = {
  connected: boolean;
  newOrders: OrderEvent[];
  updatedOrders: OrderEvent[];
  cancelledOrders: OrderEvent[];
  subscribe: (tenantId: string) => void;
  unsubscribe: () => void;
};

export function useOrderStream(): OrderStreamHook {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [newOrders, setNewOrders] = useState<OrderEvent[]>([]);
  const [updatedOrders, setUpdatedOrders] = useState<OrderEvent[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<OrderEvent[]>([]);

  const subscribe = useCallback((tenantId: string) => {
    if (socket) {
      socket.emit('subscribe', { tenantId });
    }
  }, [socket]);

  const unsubscribe = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setConnected(false);
    }
  }, [socket]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    const newSocket = io(`${wsUrl}/orders`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    newSocket.on('connect', () => {
      console.log('[OrderStream] Connected to WebSocket');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('[OrderStream] Disconnected from WebSocket');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[OrderStream] Connection error:', error);
    });

    // Listen for order events
    newSocket.on('order:new', (order: OrderEvent) => {
      console.log('[OrderStream] New order received:', order);
      setNewOrders(prev => [order, ...prev].slice(0, 50)); // Keep last 50
      
      // Play sound notification
      playOrderSound();
      
      // Show desktop notification
      showDesktopNotification(order);
    });

    newSocket.on('order:updated', (order: OrderEvent) => {
      console.log('[OrderStream] Order updated:', order);
      setUpdatedOrders(prev => [order, ...prev].slice(0, 50));
    });

    newSocket.on('order:cancelled', (order: OrderEvent) => {
      console.log('[OrderStream] Order cancelled:', order);
      setCancelledOrders(prev => [order, ...prev].slice(0, 50));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return {
    connected,
    newOrders,
    updatedOrders,
    cancelledOrders,
    subscribe,
    unsubscribe,
  };
}

/**
 * Play order notification sound
 */
function playOrderSound() {
  try {
    const audio = new Audio('/sounds/order-notification.mp3');
    audio.play().catch(error => {
      console.error('[OrderStream] Failed to play sound:', error);
    });
  } catch (error) {
    console.error('[OrderStream] Sound error:', error);
  }
}

/**
 * Show desktop notification
 */
function showDesktopNotification(order: OrderEvent) {
  if (!('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification('New Order Received', {
      body: `${order.displayOrderId} - ${order.customerName} - $${order.amount.toFixed(2)}`,
      icon: '/icons/order-icon.png',
      tag: order.id,
      requireInteraction: true,
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showDesktopNotification(order);
      }
    });
  }
}