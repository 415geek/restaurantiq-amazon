'use client';

import { useState, useEffect } from 'react';
import { Order } from '@/hooks/useOrderStream';
import { useOrderStream } from '@/hooks/useOrderStream';
import { OrderCard } from './OrderCard';
import { Plus, RefreshCw } from 'lucide-react';

interface OrderKanbanBoardProps {
  tenantId: string;
  onAcceptOrder?: (orderId: string) => void;
  onStartPrep?: (orderId: string) => void;
  onReady?: (orderId: string) => void;
  onComplete?: (orderId: string) => void;
  onCancel?: (orderId: string) => void;
}

interface KanbanData {
  new: Order[];
  preparing: Order[];
  ready: Order[];
}

export function OrderKanbanBoard({
  tenantId,
  onAcceptOrder,
  onStartPrep,
  onReady,
  onComplete,
  onCancel,
}: OrderKanbanBoardProps) {
  const [orders, setOrders] = useState<KanbanData>({
    new: [],
    preparing: [],
    ready: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket connection
  const { connected, requestNotificationPermission } = useOrderStream({
    tenantId,
    onNewOrder: (order) => {
      setOrders((prev) => ({
        ...prev,
        new: [...prev.new, order],
      }));
    },
    onOrderUpdated: (order) => {
      setOrders((prev) => {
        const updated = { ...prev };
        
        // Remove from all columns
        updated.new = updated.new.filter((o) => o.id !== order.id);
        updated.preparing = updated.preparing.filter((o) => o.id !== order.id);
        updated.ready = updated.ready.filter((o) => o.id !== order.id);
        
        // Add to appropriate column
        if (order.status === 'NEW') {
          updated.new.push(order);
        } else if (order.status === 'PREPARING') {
          updated.preparing.push(order);
        } else if (order.status === 'READY') {
          updated.ready.push(order);
        }
        
        return updated;
      });
    },
    onOrderCancelled: (order) => {
      setOrders((prev) => ({
        new: prev.new.filter((o) => o.id !== order.id),
        preparing: prev.preparing.filter((o) => o.id !== order.id),
        ready: prev.ready.filter((o) => o.id !== order.id),
      }));
    },
  });

  // Fetch initial orders
  useEffect(() => {
    fetchOrders();
    requestNotificationPermission();
  }, [tenantId]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/orders/kanban?tenantId=${tenantId}`,
      );

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) {
        throw new Error('Failed to accept order');
      }

      onAcceptOrder?.(orderId);
    } catch (err) {
      console.error('Failed to accept order:', err);
      alert('Failed to accept order. Please try again.');
    }
  };

  const handleStartPrep = async (orderId: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/start-prep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) {
        throw new Error('Failed to start preparation');
      }

      onStartPrep?.(orderId);
    } catch (err) {
      console.error('Failed to start preparation:', err);
      alert('Failed to start preparation. Please try again.');
    }
  };

  const handleReady = async (orderId: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark order as ready');
      }

      onReady?.(orderId);
    } catch (err) {
      console.error('Failed to mark order as ready:', err);
      alert('Failed to mark order as ready. Please try again.');
    }
  };

  const handleComplete = async (orderId: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete order');
      }

      onComplete?.(orderId);
    } catch (err) {
      console.error('Failed to complete order:', err);
      alert('Failed to complete order. Please try again.');
    }
  };

  const handleCancel = async (orderId: string) => {
    const reason = prompt('Please enter a reason for cancellation:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/v1/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel order');
      }

      onCancel?.(orderId);
    } catch (err) {
      console.error('Failed to cancel order:', err);
      alert('Failed to cancel order. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-600 mb-2">{error}</p>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Order Center</h2>
          <div className="flex items-center gap-2 mt-1">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-600">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* New Orders Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">New Orders</h3>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
              {orders.new.length}
            </span>
          </div>
          <div className="space-y-3">
            {orders.new.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-lg">
                <Plus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No new orders</p>
              </div>
            ) : (
              orders.new.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onAccept={() => handleAcceptOrder(order.id)}
                  onCancel={() => handleCancel(order.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Preparing Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Preparing</h3>
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-full">
              {orders.preparing.length}
            </span>
          </div>
          <div className="space-y-3">
            {orders.preparing.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-gray-500">No orders preparing</p>
              </div>
            ) : (
              orders.preparing.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onReady={() => handleReady(order.id)}
                  onCancel={() => handleCancel(order.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Ready Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Ready for Pickup</h3>
            <span className="px-2 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
              {orders.ready.length}
            </span>
          </div>
          <div className="space-y-3">
            {orders.ready.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-gray-500">No orders ready</p>
              </div>
            ) : (
              orders.ready.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onComplete={() => handleComplete(order.id)}
                  onCancel={() => handleCancel(order.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}