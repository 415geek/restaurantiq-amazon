'use client';

import { useState } from 'react';
import { OrderCountdownTimer } from './OrderCountdownTimer';
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

type OrderCardProps = {
  order: Order;
  onAction: (orderId: string, action: string) => void;
};

export function OrderCard({ order, onAction }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isNew = order.status === 'new';
  const isCancelled = order.status === 'cancelled';

  const platformColors: Record<string, string> = {
    UBEREATS: 'bg-green-500',
    DOORDASH: 'bg-red-500',
    GRUBHUB: 'bg-orange-500',
    HUNGRYPANDA: 'bg-yellow-500',
    FANTUAN: 'bg-red-600',
  };

  const platformColor = platformColors[order.platform] || 'bg-gray-500';

  return (
    <div
      className={`
        bg-white rounded-lg shadow-sm border-2 transition-all
        ${isNew ? 'border-orange-500 animate-pulse' : 'border-gray-200'}
        ${isCancelled ? 'opacity-50' : ''}
      `}
    >
      {/* Order Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`${platformColor} px-2 py-1 rounded text-white text-xs font-bold`}>
              {order.platform}
            </div>
            <span className="font-bold text-gray-900">{order.displayOrderId}</span>
          </div>
          {isNew && <OrderCountdownTimer etaMins={order.etaMins} />}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Customer:</span>
            <span className="font-medium text-gray-900">{order.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total:</span>
            <span className="font-bold text-gray-900">${order.amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">ETA:</span>
            <span className="font-medium text-gray-900">{order.etaMins} min</span>
          </div>
        </div>

        {/* Items Preview */}
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            {expanded ? 'Hide items' : `Show ${order.items.length} items`}
          </button>
        </div>
      </div>

      {/* Expanded Items */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <ul className="space-y-1 text-sm">
            {order.items.map((item, index) => (
              <li key={index} className="text-gray-700">
                • {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100">
        <OrderActions order={order} onAction={onAction} />
      </div>
    </div>
  );
}

function OrderActions({ order, onAction }: { order: Order; onAction: (orderId: string, action: string) => void }) {
  switch (order.status) {
    case 'new':
      return (
        <div className="flex gap-2">
          <button
            onClick={() => onAction(order.id, 'accept')}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => {
              const reason = prompt('Reason for cancellation:');
              if (reason) {
                onAction(order.id, 'cancel');
              }
            }}
            className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-600 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      );

    case 'accepted':
      return (
        <button
          onClick={() => onAction(order.id, 'start-prep')}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          Start Preparation
        </button>
      );

    case 'preparing':
      return (
        <button
          onClick={() => onAction(order.id, 'ready')}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          Mark Ready
        </button>
      );

    case 'ready':
      return (
        <button
          onClick={() => onAction(order.id, 'complete')}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          Complete Order
        </button>
      );

    case 'cancelled':
      return (
        <div className="text-center text-gray-500 text-sm py-2">
          Order Cancelled
        </div>
      );

    case 'completed':
      return (
        <div className="text-center text-green-600 text-sm py-2 font-medium">
          ✓ Completed
        </div>
      );

    default:
      return null;
  }
}