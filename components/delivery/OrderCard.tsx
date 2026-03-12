'use client';

import { Order } from '@/hooks/useOrderStream';
import { OrderCountdownTimer } from './OrderCountdownTimer';
import { Clock, User, Package, DollarSign, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface OrderCardProps {
  order: Order;
  onAccept?: () => void;
  onStartPrep?: () => void;
  onReady?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
}

export function OrderCard({
  order,
  onAccept,
  onStartPrep,
  onReady,
  onComplete,
  onCancel,
  showActions = true,
}: OrderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ACCEPTED':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'PREPARING':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'READY':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getActionButton = () => {
    switch (order.status) {
      case 'NEW':
        return (
          <button
            onClick={onAccept}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Accept Order
          </button>
        );
      case 'ACCEPTED':
        return (
          <button
            onClick={onStartPrep}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Start Preparation
          </button>
        );
      case 'PREPARING':
        return (
          <button
            onClick={onReady}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Mark Ready
          </button>
        );
      case 'READY':
        return (
          <button
            onClick={onComplete}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Complete Order
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border-2 transition-all hover:shadow-md ${
        order.status === 'NEW' ? 'border-blue-300' : 'border-gray-200'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-gray-900">
                #{order.displayOrderId}
              </h3>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(
                  order.status,
                )}`}
              >
                {order.status}
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>{order.customerName}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-lg font-semibold text-gray-900">
              <DollarSign className="w-5 h-5" />
              <span>${order.total.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <Clock className="w-3 h-3" />
              <span>{new Date(order.placedAt).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Countdown Timer */}
        {order.status === 'NEW' && (
          <div className="mt-3">
            <OrderCountdownTimer
              placedAt={order.placedAt}
              etaMins={order.etaMins}
              onTimeout={() => console.log('Order timeout:', order.id)}
            />
          </div>
        )}
      </div>

      {/* Items */}
      <div className="p-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors w-full"
        >
          <Package className="w-4 h-4" />
          <span className="font-medium">
            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </span>
          <span className="ml-auto text-xs text-gray-400">
            {isExpanded ? 'Hide' : 'Show'} details
          </span>
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-2">
            {order.items.map((item: any, index: number) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {item.quantity}x {item.name}
                </span>
                <span className="text-gray-600">${item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && getActionButton() && (
        <div className="p-4 border-t border-gray-100">
          {getActionButton()}
        </div>
      )}

      {/* Cancel Button */}
      {showActions && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
        <div className="px-4 pb-4">
          <button
            onClick={onCancel}
            className="w-full text-red-600 hover:text-red-700 text-sm font-medium py-2 transition-colors"
          >
            Cancel Order
          </button>
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="px-4 pb-4">
          <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-800">{order.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}