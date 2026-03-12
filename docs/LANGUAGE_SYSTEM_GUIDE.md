# Restaurant IQ 语言系统使用指南

## 概述

Restaurant IQ 实现了完整的双语支持系统,包含两个层面的语言管理:

1. **系统级语言切换**: 控制整个应用界面的语言(按钮、标签、提示等)
2. **内容级语言翻译**: 翻译来自API的原始数据(评论、分析结果等)

## 系统级语言切换

### 语言切换按钮

位置: 顶部导航栏右侧

- 点击按钮可在中文(中)和英文(EN)之间切换
- 语言偏好会保存在本地存储中
- 刷新页面后会保持用户选择的语言

### 语言覆盖范围

系统级语言切换覆盖以下所有模块:

- ✅ 导航栏和侧边栏
- ✅ 仪表盘(Dashboard)
- ✅ 分析中心(Analysis Center)
- ✅ 社媒雷达(Social Radar)
- ✅ 订单中心(Delivery Management)
- ✅ 菜单管理(Menu Management)
- ✅ 经营 Copilot(Ops Copilot)
- ✅ Agent 管理(Agent Studio)
- ✅ 设置(Settings)
- ✅ 账户(Account)
- ✅ 所有按钮、标签、提示信息

## 内容级语言翻译

### 翻译功能特点

1. **保留原始语言**: API返回的数据(如Google Reviews、Yelp评论)默认显示原始语言
2. **按需翻译**: 每个内容模块都有独立的翻译按钮
3. **精准翻译**: 使用大模型进行翻译,确保100%准确,不猜测或修改内容
4. **双向切换**: 可以在原文和翻译之间自由切换
5. **独立控制**: 翻译不影响系统级语言设置

### 支持翻译的内容模块

#### 1. Google Reviews 评论
- 位置: 分析中心 → 商家情报 → Google Reviews
- 翻译按钮: 每条评论下方
- 翻译内容: 评论文本

#### 2. Yelp Reviews 评论
- 位置: 分析中心 → 商家情报 → Yelp Reviews
- 翻译按钮: 每条评论下方
- 翻译内容: 评论文本

#### 3. 社媒评论
- 位置: 社媒雷达 → 最新评论与回复
- 翻译按钮: 每条评论下方
- 翻译内容: 评论文本

#### 4. 社媒提及
- 位置: 社媒雷达 → 外部博主提及博文
- 翻译按钮: 每条博文摘要下方
- 翻译内容: 博文摘要

#### 5. 分析结论摘要
- 位置: 分析中心 → 商家情报 → 分析结论摘要
- 翻译按钮: 摘要内容下方
- 翻译内容: 分析摘要文本

#### 6. 评论深度分析
- 位置: 分析中心 → 商家情报 → 评论深度分析
- 翻译按钮: 每个主题的证据下方
- 翻译内容: 主题证据文本

#### 7. 竞对分析
- 位置: 分析中心 → 商家情报 → 精准竞对分析
- 翻译按钮: 每个竞对的说明下方
- 翻译内容: 竞对分析说明

### 翻译按钮使用方法

1. **翻译内容**:
   - 点击"翻译"按钮
   - 等待翻译完成(显示加载动画)
   - 翻译完成后显示翻译内容

2. **查看原文**:
   - 点击"显示原文"按钮
   - 立即切换回原始语言内容

3. **再次翻译**:
   - 再次点击"翻译"按钮
   - 显示已缓存的翻译内容(无需重新请求)

## 技术实现

### 语言系统架构

```
┌─────────────────────────────────────────┐
│   DashboardLanguageProvider             │
│   (系统级语言状态管理)                   │
└──────────────┬──────────────────────────┘
               │
               ├─> 语言切换按钮
               │
               ├─> 所有UI组件
               │   (使用 copy 对象获取翻译文本)
               │
               └─> ContentTranslator组件
                   (内容级翻译)
```

### 核心组件

#### 1. DashboardLanguageProvider
- 文件: `components/providers/DashboardLanguageProvider.tsx`
- 功能: 管理系统级语言状态
- 提供: `lang`, `setLang`, `toggleLang`, `copy`

#### 2. ContentTranslator
- 文件: `components/ui/ContentTranslator.tsx`
- 功能: 提供内容翻译功能
- Props:
  - `originalContent`: 原始内容
  - `translatedContent`: 已翻译内容(可选)
  - `contentType`: 内容类型
  - `size`: 按钮大小

#### 3. 翻译API
- 文件: `app/api/translate/route.ts`
- 功能: 处理翻译请求
- 端点: `POST /api/translate`

### 语言配置文件

- 文件: `lib/dashboard-language.ts`
- 结构:
```typescript
export const dashboardCopy = {
  zh: {
    // 中文翻译
    common: { ... },
    dashboardPage: { ... },
    // ...
  },
  en: {
    // 英文翻译
    common: { ... },
    dashboardPage: { ... },
    // ...
  }
}
```

## 使用示例

### 在组件中使用系统级翻译

```tsx
import { useDashboardLanguage } from '@/components/providers/DashboardLanguageProvider';

function MyComponent() {
  const { copy, lang } = useDashboardLanguage();
  
  return (
    <div>
      <h1>{copy.dashboardPage.title}</h1>
      <p>{copy.dashboardPage.description}</p>
      <button>{copy.common.save}</button>
    </div>
  );
}
```

### 在组件中使用内容翻译

```tsx
import { ContentTranslator } from '@/components/ui/ContentTranslator';

function ReviewCard({ review }) {
  return (
    <div>
      <h3>{review.author}</h3>
      <ContentTranslator
        originalContent={review.text}
        contentType="review"
        size="sm"
      />
    </div>
  );
}
```

## 翻译服务配置

### 当前状态

翻译API已创建,但需要配置实际的翻译服务。当前使用占位实现。

### 配置步骤

1. **选择翻译服务**:
   - Google Translate API
   - DeepL API
   - OpenAI API
   - 其他翻译服务

2. **配置环境变量**:
```bash
# .env.local
OPENAI_API_KEY=your_openai_api_key
# 或
GOOGLE_TRANSLATE_API_KEY=your_google_api_key
```

3. **更新翻译API实现**:
编辑 `app/api/translate/route.ts`,取消注释实际的翻译代码。

### 翻译质量保证

为确保翻译质量,翻译服务应遵循以下原则:

1. **100%准确**: 不猜测或修改内容
2. **保持语气**: 保留原文的情感和风格
3. **专业术语**: 保留技术术语和专有名词
4. **上下文感知**: 根据内容类型调整翻译策略

## 最佳实践

### 1. 添加新的UI文本

```typescript
// 1. 在 lib/dashboard-language.ts 中添加翻译
export const dashboardCopy = {
  zh: {
    myModule: {
      title: '我的模块',
      description: '模块描述',
    }
  },
  en: {
    myModule: {
      title: 'My Module',
      description: 'Module description',
    }
  }
}

// 2. 在组件中使用
const { copy } = useDashboardLanguage();
<h1>{copy.myModule.title}</h1>
```

### 2. 添加新的翻译内容模块

```tsx
// 使用 ContentTranslator 组件
<ContentTranslator
  originalContent={apiData.content}
  contentType="analysis"
  size="sm"
/>
```

### 3. 内容类型选择

根据内容类型选择合适的 `contentType`:

- `review`: 评论内容
- `comment`: 社媒评论
- `analysis`: 分析结果
- `general`: 通用内容

## 故障排除

### 翻译按钮不工作

1. 检查浏览器控制台是否有错误
2. 确认翻译API端点可访问
3. 检查网络连接

### 翻译质量不佳

1. 检查翻译服务配置
2. 调整翻译提示词
3. 考虑使用更专业的翻译服务

### 语言切换不生效

1. 清除浏览器缓存
2. 检查本地存储是否被禁用
3. 确认语言配置文件正确

## 未来改进

1. **批量翻译**: 支持批量翻译多个内容项
2. **翻译缓存**: 实现客户端翻译缓存
3. **自动检测**: 自动检测内容语言并提示翻译
4. **更多语言**: 支持更多语言选项
5. **翻译历史**: 保存翻译历史记录

## 联系支持

如有问题或建议,请联系开发团队或提交Issue。