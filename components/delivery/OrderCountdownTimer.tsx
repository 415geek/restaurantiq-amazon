'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

interface OrderCountdownTimerProps {
  placedAt: string;
  etaMins?: number;
  onTimeout?: () => void;
}

export function OrderCountdownTimer({ placedAt, etaMins = 5, onTimeout }: OrderCountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(etaMins * 60); // Convert to seconds
  const [isTimeout, setIsTimeout] = useState(false);

  useEffect(() => {
    const placedTime = new Date(placedAt).getTime();
    const timeoutTime = placedTime + etaMins * 60 * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((timeoutTime - now) / 1000));
      
      setTimeLeft(remaining);

      if (remaining === 0 && !isTimeout) {
        setIsTimeout(true);
        onTimeout?.();
      }
    };

    // Initial update
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [placedAt, etaMins, isTimeout, onTimeout]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium ${
        isTimeout
          ? 'bg-red-100 text-red-700 animate-pulse'
          : timeLeft < 60
          ? 'bg-orange-100 text-orange-700'
          : 'bg-blue-50 text-blue-700'
      }`}
    >
      {isTimeout ? (
        <>
          <AlertCircle className="w-4 h-4" />
          <span>TIMEOUT</span>
        </>
      ) : (
        <>
          <Clock className="w-4 h-4" />
          <span>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </>
      )}
    </div>
  );
}