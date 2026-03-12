'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, AlertCircle } from 'lucide-react';

interface UberEatsAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (storeId?: string) => void;
}

export function UberEatsAuthModal({ isOpen, onClose, onConnect }: UberEatsAuthModalProps) {
  const [authUrl, setAuthUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetchAuthUrl();
    } else {
      setAuthUrl('');
      setError('');
    }
  }, [isOpen]);

  const fetchAuthUrl = async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/ubereats/auth/start', { cache: 'no-store' });
      const data = await res.json();

      if (data.ok) {
        setAuthUrl(data.authUrl);
      } else {
        const configCheck = await fetch('/api/ubereats/auth/check', { cache: 'no-store' });
        const configData = await configCheck.json();

        if (!configData.configured) {
          setError('Uber Eats not configured. Please contact support.');
        }
      }
    } catch (err) {
      console.error('Failed to fetch auth URL:', err);
      setError('Failed to initialize authorization');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    if (!authUrl) return;
    // 打开新窗口进行OAuth授权
    window.open(authUrl, '_blank', 'width=600,height=700');
    // 关闭模态，开始轮询授权状态
    onClose();
    startAuthPolling();
  };

  const startAuthPolling = () => {
    // 每2秒检查一次授权状态
    const interval = setInterval(() => {
      checkAuthStatus();
    }, 2000);

    // 5分钟后停止轮询
    setTimeout(() => {
      clearInterval(interval);
    }, 5 * 60 * 1000);
  };

  const checkAuthStatus = async () => {
    try {
      // 检查URL参数中的状态
      const urlParams = new URLSearchParams(window.location.search);
      const status = urlParams.get('ubereats_status');
      const storeId = urlParams.get('storeId');
      const error = urlParams.get('ubereats_error');

      if (status === 'connected' || error) {
        // 授权成功或失败，停止轮询并刷新页面
        window.location.href = '/delivery';
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-semibold text-zinc-900">
            Connect to Uber Eats
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-zinc-600 mb-4">
            Connect your Uber Eats account to enable order management and menu synchronization.
            This will redirect you to Uber's authorization page.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-zinc-700">Store ID (Optional)</span>
              <input
                type="text"
                placeholder="e.g., store_12345"
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <p className="text-xs text-zinc-500">
              Leave empty to use default store, or enter a specific store ID if you have multiple locations.
            </p>
          </div>

          <button
            type="button"
            onClick={handleConnect}
            disabled={isLoading || !authUrl}
            className="w-full bg-[#F26A36] hover:bg-[#f05029] text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Initializing...' : 'Connect to Uber Eats'}
          </button>

          <div className="flex items-start gap-2 text-xs text-zinc-500">
            <ExternalLink className="h-4 w-4 flex-shrink-0" />
            <div>
              <p>By clicking "Connect", you will be redirected to Uber's secure authorization page.</p>
              <p>After authorization, you will return here automatically.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
