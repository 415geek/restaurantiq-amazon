'use client';

import { useState, useEffect } from 'react';

type OrderCountdownTimerProps = {
  etaMins: number;
  warningThreshold?: number; // minutes
  criticalThreshold?: number; // minutes
};

export function OrderCountdownTimer({
  etaMins,
  warningThreshold = 3,
  criticalThreshold = 1,
}: OrderCountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(etaMins * 60); // in seconds
  const [isWarning, setIsWarning] = useState(false);
  const [isCritical, setIsCritical] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const minutesLeft = Math.ceil(timeLeft / 60);
    setIsWarning(minutesLeft <= warningThreshold && minutesLeft > criticalThreshold);
    setIsCritical(minutesLeft <= criticalThreshold);
  }, [timeLeft, warningThreshold, criticalThreshold]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const percentage = (timeLeft / (etaMins * 60)) * 100;

  return (
    <div className="flex items-center gap-2">
      {/* Timer Display */}
      <div
        className={`
          font-mono font-bold text-sm
          ${isCritical ? 'text-red-600 animate-pulse' : isWarning ? 'text-orange-600' : 'text-gray-700'}
        `}
      >
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>

      {/* Progress Bar */}
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`
            h-full transition-all duration-1000
            ${isCritical ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-green-500'}
          `}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}