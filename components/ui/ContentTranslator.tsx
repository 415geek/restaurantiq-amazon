'use client';

import { useState, useEffect } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

interface ContentTranslatorProps {
  /** 原始内容(来自API的数据) */
  originalContent: string;
  /** 可选的已翻译内容(如果后端已提供) */
  translatedContent?: string;
  /** 内容类型,用于显示不同的提示文本 */
  contentType?: 'review' | 'comment' | 'analysis' | 'general';
  /** 是否显示为小按钮 */
  size?: 'sm' | 'md';
  /** 自定义样式类名 */
  className?: string;
  /** 当 lang='en' 时自动翻译，无需手动点击 */
  autoTranslate?: boolean;
}

/**
 * 内容翻译组件
 * 
 * 功能:
 * 1. 显示原始内容(来自API的数据,保持原始语言)
 * 2. 提供翻译按钮,点击后通过大模型翻译内容
 * 3. 支持切换回原始语言
 * 4. 翻译内容100%准确,不猜测或修改内容
 * 
 * 使用场景:
 * - Google Reviews 评论
 * - Yelp Reviews 评论
 * - 社媒评论
 * - 分析结果
 */
export function ContentTranslator({
  originalContent,
  translatedContent: initialTranslatedContent,
  contentType = 'general',
  size = 'sm',
  className = '',
  autoTranslate = false,
}: ContentTranslatorProps) {
  const { lang } = useDashboardLanguage();
  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState(initialTranslatedContent || '');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contentTypeLabels = {
    review: lang === 'zh' ? '评论' : 'Review',
    comment: lang === 'zh' ? '评论' : 'Comment',
    analysis: lang === 'zh' ? '分析' : 'Analysis',
    general: lang === 'zh' ? '内容' : 'Content',
  };

  const translateButtonLabel = isTranslated
    ? (lang === 'zh' ? '显示原文' : 'Show Original')
    : (lang === 'zh' ? '翻译' : 'Translate');

  const handleTranslate = async () => {
    if (isTranslated) {
      // 切换回原文
      setIsTranslated(false);
      return;
    }

    // 如果已有翻译内容,直接显示
    if (translatedText) {
      setIsTranslated(true);
      return;
    }

    // 调用翻译API
    setIsTranslating(true);
    setError(null);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: originalContent,
          targetLang: lang === 'zh' ? 'zh-CN' : 'en',
          contentType,
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      setTranslatedText(data.translatedText || '');
      setIsTranslated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation error');
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Auto-translate when lang='en' and autoTranslate is enabled
  useEffect(() => {
    if (autoTranslate && lang === 'en' && !isTranslated && !translatedText && !isTranslating) {
      void handleTranslate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTranslate, lang, originalContent]);

  const displayContent = isTranslated && translatedText ? translatedText : originalContent;

  return (
    <div className={`content-translator ${className}`}>
      <div className="relative">
        {/* 内容显示区域 */}
        <div className="text-sm text-zinc-300 whitespace-pre-wrap break-words">
          {displayContent}
        </div>

        {/* 翻译按钮 */}
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size={size}
            onClick={handleTranslate}
            disabled={isTranslating}
            className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200"
          >
            {isTranslating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Languages className="h-3 w-3" />
            )}
            <span className="ml-1">{translateButtonLabel}</span>
          </Button>

          {/* 显示内容类型标签 */}
          {isTranslated && (
            <span className="text-[10px] text-zinc-500">
              {lang === 'zh' ? '已翻译' : 'Translated'} · {contentTypeLabels[contentType]}
            </span>
          )}

          {/* 错误提示 */}
          {error && (
            <span className="text-[10px] text-red-400">
              {lang === 'zh' ? '翻译失败' : 'Translation failed'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 简化版翻译按钮,只显示按钮,不包含内容显示
 * 用于需要自定义布局的场景
 */
export function TranslateButton({
  onTranslate,
  isTranslated,
  isTranslating,
  size = 'sm',
}: {
  onTranslate: () => void;
  isTranslated: boolean;
  isTranslating: boolean;
  size?: 'sm' | 'md';
}) {
  const { lang } = useDashboardLanguage();

  const label = isTranslated
    ? (lang === 'zh' ? '显示原文' : 'Show Original')
    : (lang === 'zh' ? '翻译' : 'Translate');

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={onTranslate}
      disabled={isTranslating}
      className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200"
    >
      {isTranslating ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Languages className="h-3 w-3" />
      )}
      <span className="ml-1">{label}</span>
    </Button>
  );
}