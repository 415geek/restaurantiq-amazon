import { NextRequest, NextResponse } from 'next/server';

/**
 * 翻译API路由
 * 
 * 功能:
 * 1. 接收文本和目标语言
 * 2. 调用大模型进行翻译
 * 3. 返回翻译结果
 * 
 * 翻译原则:
 * - 100%准确翻译,不猜测或修改内容
 * - 保持原文的语气和风格
 * - 只翻译语言,不改变含义
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, targetLang, contentType = 'general' } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Invalid text input' },
        { status: 400 }
      );
    }

    if (!targetLang || (targetLang !== 'zh-CN' && targetLang !== 'en')) {
      return NextResponse.json(
        { error: 'Invalid target language' },
        { status: 400 }
      );
    }

    // 检测文本语言
    const detectedLang = detectLanguage(text);
    
    // 如果目标语言和检测到的语言相同,直接返回原文
    if (detectedLang === targetLang) {
      return NextResponse.json({
        translatedText: text,
        originalLang: detectedLang,
        targetLang,
        skipped: true,
      });
    }

    // 调用翻译服务
    const translatedText = await translateText(text, targetLang, contentType);

    return NextResponse.json({
      translatedText,
      originalLang: detectedLang,
      targetLang,
      contentType,
    });
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Translation service unavailable' },
      { status: 500 }
    );
  }
}

/**
 * 简单的语言检测
 * 基于字符集判断是中文还是英文
 */
function detectLanguage(text: string): 'zh-CN' | 'en' {
  // 统计中文字符数量
  const chineseCharCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;

  // 如果中文字符占比超过30%,认为是中文
  if (totalChars > 0 && chineseCharCount / totalChars > 0.3) {
    return 'zh-CN';
  }

  return 'en';
}

/**
 * 翻译文本
 * 
 * 这里使用简单的翻译逻辑,实际项目中应该:
 * 1. 使用专业的翻译API(如Google Translate, DeepL等)
 * 2. 或者使用大模型API(如OpenAI, Anthropic等)
 * 
 * 为了演示,这里使用一个简单的占位实现
 */
async function translateText(
  text: string,
  targetLang: string,
  contentType: string
): Promise<string> {
  // TODO: 实际项目中应该调用真实的翻译服务
  // 这里提供一个示例实现框架
  
  // 示例: 使用OpenAI API进行翻译
  /*
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `You are a professional translator. Your task is to translate the given text ${targetLang === 'zh-CN' ? 'to Chinese' : 'to English'}.

Rules:
1. Translate 100% accurately - do not guess or modify the content
2. Maintain the original tone and style
3. Only translate the language, do not change the meaning
4. For reviews/comments, preserve the original sentiment
5. For analysis content, preserve technical terms and data
6. Return ONLY the translated text, no explanations`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || text;
  */

  // 临时占位实现 - 实际使用时需要替换为真实的翻译服务
  // 这里返回原文,避免误导
  console.warn('Translation service not configured, returning original text');
  return text;
}