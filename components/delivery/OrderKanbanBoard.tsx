'use client';

import { useState, useEffect } from 'react';
import { useOrderStream } from '@/hooks/useOrderStream';
import { OrderCard } from './OrderCard';
import type { DeliveryOrderStatus } from '@/lib/delivery-management-types';

type Order = {
  id: string;
  displayOrderId: string;
  platform: string;
  status: DeliveryOrderStatus;
  customerName: string;
  amount: number;
  items: string[];
  placedAt: string;
  etaMins: number;
};

type KanbanColumn = {
  id: DeliveryOrderStatus;
  title: string;
  titleZh: string;
  color: string;
  orders: Order[];
};

export function OrderKanbanBoard({ tenantId }: { tenantId: string }) {
  const { connected, newOrders, updatedOrders, cancelledOrders, subscribe, unsubscribe } = useOrderStream();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to WebSocket
  useEffect(() => {
    if (tenantId) {
      subscribe(tenantId);
    }
    return () => unsubscribe();
  }, [tenantId, subscribe, unsubscribe]);

  // Fetch initial orders
  useEffect(() => {
    fetchOrders();
  }, [tenantId]);

  // Handle real-time updates
  useEffect(() => {
    if (newOrders.length > 0) {
      setOrders(prev => {
        const newOrder = newOrders[0];
        const exists = prev.find(o => o.id === newOrder.id);
        if (exists) {
          return prev.map(o => o.id === newOrder.id ? { ...o, ...newOrder } : o);
        }
        return [newOrder, ...prev];
      });
    }
  }, [newOrders]);

  useEffect(() => {
    if (updatedOrders.length > 0) {
      setOrders(prev => {
        const updatedOrder = updatedOrders[0];
        return prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o);
      });
    }
  }, [updatedOrders]);

  useEffect(() => {
    if (cancelledOrders.length > 0) {
      setOrders(prev => {
        const cancelledOrder = cancelledOrders[0];
        return prev.map(o => o.id === cancelledOrder.id ? { ...o, ...cancelledOrder } : o);
      });
    }
  }, [cancelledOrders]);

  async function fetchOrders() {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/orders?tenantId=${tenantId}`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('[OrderKanbanBoard] Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }

  // Group orders by status
  const columns: KanbanColumn[] = [
    {
      id: 'new',
      title: 'New Orders',
      titleZh: '新订单',
      color: 'bg-orange-500',
      orders: orders.filter(o => o.status === 'new'),
    },
    {
      id: 'preparing',
      title: 'Preparing',
      titleZh: '制作中',
      color: 'bg-blue-500',
      orders: orders.filter(o => o.status === 'preparing' || o.status === 'accepted'),
    },
    {
      id: 'ready',
      title: 'Ready for Pickup',
      titleZh: '待取餐',
      color: 'bg-green-500',
      orders: orders.filter(o => o.status === 'ready'),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Order Center</h1>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
        {columns.map(column => (
          <KanbanColumn
            key={column.id}
            column={column}
            onOrderAction={handleOrderAction}
          />
        ))}
      </div>
    </div>
  );
}

function KanbanColumn({
  column,
  onOrderAction,
}: {
  column: KanbanColumn;
  onOrderAction: (orderId: string, action: string) => void;
}) {
  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-xl overflow-hidden">
      {/* Column Header */}
      <div className={`${column.color} px-4 py-3 flex items-center justify-between`}>
        <div>
          <h2 className="text-white font-semibold">{column.title}</h2>
          <p className="text-white/80 text-sm">{column.titleZh}</p>
        </div>
        <div className="bg-white/20 px-3 py-1 rounded-full">
          <span className="text-white font-bold">{column.orders.length}</span>
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {column.orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            onAction={onOrderAction}
          />
        ))}

        {column.orders.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <p>No orders</p>
          </div>
        )}
      </div>
    </div>
  );
}

async function handleOrderAction(orderId: string, action: string) {
  try {
    const response = await fetch(`/api/v1/orders/${orderId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'default-tenant' }),
    });

    if (!response.ok) {
      throw new Error('Failed to perform action');
    }

    const result = await response.json();
    console.log('[OrderKanbanBoard] Action successful:', result);
  } catch (error) {
    console.error('[OrderKanbanBoard] Action failed:', error);
    alert('Failed to perform action. Please try again.');
  }
}