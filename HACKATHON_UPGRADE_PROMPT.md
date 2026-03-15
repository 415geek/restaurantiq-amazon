# 🏆 Amazon Nova AI Hackathon - RestaurantIQ.ai 升级开发指南

> **评审身份**: Amazon Nova Hackathon 首席评审
> **评估日期**: 2026-03-15
> **项目地址**: https://restaurantiq.ai | https://github.com/415geek/restaurantiq-amazon

---

## 一、评审总结 (Executive Summary)

### 项目得分预估 (60% Technical Implementation)

| 维度 | 当前评分 | 获胜标准 | 差距 |
|------|---------|---------|------|
| Nova 模型集成 | 40/100 | 85+ | ⚠️ 需要真正集成 Nova 2 Lite/Pro |
| Nova Act 集成 | 10/100 | 80+ | 🔴 完全缺失，仅有占位符 |
| 系统架构 | 75/100 | 80+ | ✅ 接近达标 |
| UI/UX 完成度 | 70/100 | 85+ | 🟡 语言混合问题严重 |
| 创新性 | 80/100 | 85+ | ✅ 垂直领域AI Agent概念优秀 |

**综合评估**: 当前状态无法获奖。核心问题是 **Amazon Nova 集成不足** 和 **语言体验不一致**。

---

## 二、Critical Issues（必须修复）

### 🔴 CRITICAL-1: Nova Act 完全缺失

**问题描述**:
- 界面持续显示 "Nova Act live browser simulation is not configured"
- `lib/server/aws-nova-client.ts` 只是一个基础 Bedrock LLM 客户端
- 缺少真正的 Nova Act SDK 集成用于 UI 自动化

**修复方案**:
```bash
# 安装 Nova Act SDK
npm install @anthropic-ai/nova-act-sdk
```

**需要实现**:
1. 使用 Nova Act 自动抓取 DoorDash/GrubHub 竞争对手菜单
2. 使用 Nova Act 自动监控 Yelp/Google Reviews 变化
3. 使用 Nova Act 自动执行价格调整到各平台

### 🔴 CRITICAL-2: LLM 模型名称错误

**问题位置**: `lib/server/llm/provider-json.ts`

**错误代码**:
```typescript
// ❌ 不存在的模型名
model: 'gpt-4.1-mini'
model: 'claude-3-7-sonnet-latest'
model: 'claude-3-5-haiku-latest'
```

**正确修复**:
```typescript
// ✅ 正确的模型名称
model: 'gpt-4o-mini'
model: 'claude-3-5-sonnet-latest' 
model: 'claude-3-5-haiku-latest'
// 或使用 Amazon Nova
model: 'amazon.nova-lite-v1:0'
model: 'amazon.nova-pro-v1:0'
```

### 🔴 CRITICAL-3: Daily Briefing LLM 不可用

**现象**: Dashboard 显示 "Fallback" 而非 "Live"

**根因**: 
1. OPENAI_API_KEY 未配置
2. Anthropic API 调用失败无 fallback 到 Nova

**修复**: 添加 Nova 作为 primary provider

### 🔴 CRITICAL-4: 语言混合严重

**问题**:
- 切换到 English 后仍显示大量中文: "总营收", "平均客单价", "日均订单", "折扣率"
- Executive Summary 默认中文，需手动点击 "Translate"
- 部分 Badge 文本混合

**修复位置**: `lib/dashboard-language.ts` 和各组件

---

## 三、High Priority Issues（显著影响评分）

### 🟡 HIGH-1: Revenue Trend 图表为空

**现象**: Dashboard 显示 "--" 无数据

**修复**: 从 mock-data 或 analysis runtime 正确读取并渲染图表

### 🟡 HIGH-2: Platform Order Mix 为空

**现象**: "No platform split available yet. Connect delivery platforms..."

**修复**: 即使在 demo 模式也应显示模拟的平台分布

### 🟡 HIGH-3: Settings 页面 Model Routing 显示虚假模型

**现象**: 显示 "gpt-5-mini", "gpt-5" 等不存在的模型

**修复**: 显示真实可用模型或 Nova 模型

### 🟡 HIGH-4: 执行日志时间格式异常

**现象**: 显示 "1:51:22 AM" 而非合理时间

**修复**: 使用正确的时区处理

---

## 四、功能完善建议

### 🟢 MED-1: 增加 Nova 2 Sonic 语音点餐演示

这是 hackathon 的亮点功能，建议增加:
- 双语语音输入点餐
- 实时语音转文字
- 语音确认订单

### 🟢 MED-2: 增加 Nova Act 竞品扫描演示

演示 Nova Act 自动化能力:
- 自动打开 DoorDash 搜索附近中餐
- 抓取竞品价格和评分
- 生成竞争分析报告

### 🟢 MED-3: 增强多模态能力展示

使用 Nova 的多模态能力:
- 上传菜品照片自动生成描述
- 分析用户上传的差评截图
- 从 POS 收据图片提取数据

---

## 五、升级开发提示词 (Claude Code Optimized)

### Phase 1: 修复 Critical Issues (预计 2-3 小时)

```
TASK: Fix RestaurantIQ Critical Issues for Amazon Nova Hackathon

PROJECT: /home/claude/restaurantiq-amazon
SERVER: 34.220.87.202

PRIORITY 1 - Fix LLM Model Names:
File: lib/server/llm/provider-json.ts
- Replace 'gpt-4.1-mini' with 'gpt-4o-mini'
- Replace 'claude-3-7-sonnet-latest' with 'claude-3-5-sonnet-latest'
- Add Nova as primary provider for hackathon demo

PRIORITY 2 - Fix Language Mixing:
Files: lib/dashboard-language.ts, components/dashboard/*.tsx
- Ensure ALL UI text respects language toggle
- Chinese labels like "总营收", "平均客单价" must have English alternatives
- Use lang === 'en' checks consistently

PRIORITY 3 - Enable Daily Briefing:
File: lib/server/daily-briefing.ts
- Add Nova model as fallback when OpenAI/Anthropic unavailable
- Ensure deterministic fallback shows useful content

PRIORITY 4 - Fix Data Visualizations:
Files: components/dashboard/OperationalSnapshot.tsx
- Show mock revenue trend data
- Show mock platform order mix data
- Remove "No data" states for demo

CONSTRAINTS:
- Minimal changes, surgical fixes
- Test each change in browser
- Commit after each priority
```

### Phase 2: Nova Act Integration (预计 3-4 小时)

```
TASK: Integrate Amazon Nova Act for UI Automation Demo

CREATE NEW FILES:
1. lib/server/nova-act/client.ts - Nova Act SDK wrapper
2. lib/server/nova-act/market-scanner.ts - Competitor scanning
3. lib/server/nova-act/review-monitor.ts - Review monitoring
4. app/api/nova-act/scan/route.ts - API endpoint

IMPLEMENTATION SPEC:

// lib/server/nova-act/client.ts
import { NovaAct } from '@aws-sdk/nova-act';

export class NovaActClient {
  private client: NovaAct;
  
  async scanCompetitor(platform: 'doordash' | 'ubereats', address: string) {
    // Use Nova Act to:
    // 1. Navigate to platform
    // 2. Search for restaurants near address
    // 3. Extract menu items and prices
    // 4. Return structured data
  }
  
  async monitorReviews(businessName: string, platforms: string[]) {
    // Use Nova Act to:
    // 1. Navigate to Google/Yelp
    // 2. Search for business
    // 3. Extract recent reviews
    // 4. Return review data
  }
}

UI INTEGRATION:
- Add "Run Nova Act Scan" button to Analysis page
- Show real-time progress of automation
- Display extracted competitor data

DEMO MODE:
- When Nova Act credentials missing, show recorded demo
- Pre-record a scan session as fallback
```

### Phase 3: Nova 2 Model Integration (预计 2 小时)

```
TASK: Replace OpenAI/Anthropic with Amazon Nova Models

TARGET FILES:
- lib/server/llm/provider-json.ts
- lib/server/daily-briefing.ts
- lib/server/agents/agent-b-analyzer.ts
- lib/server/agents/agent-c-planner.ts

MODEL ROUTING:
Simple tasks: amazon.nova-lite-v1:0 (fast, cheap)
Analysis tasks: amazon.nova-pro-v1:0 (balanced)
Critical decisions: amazon.nova-premier-v1:0 (best quality)

IMPLEMENTATION:
1. Update aws-nova-client.ts to use AWS SDK properly
2. Add structured output support with tool_use
3. Implement proper error handling and fallback
4. Update Settings UI to show Nova models

ENV VARS NEEDED:
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION=us-east-1
```

### Phase 4: Polish & Demo Recording (预计 2 小时)

```
TASK: Final Polish for Hackathon Submission

UI POLISH:
1. Fix all remaining Chinese text when lang=en
2. Add loading states for all async operations
3. Ensure all buttons have click feedback
4. Fix time zone display issues

DEMO PREPARATION:
1. Seed database with compelling demo data
2. Record 3-minute demo video showcasing:
   - Dashboard overview
   - Nova-powered analysis
   - Nova Act competitor scanning
   - Ops Copilot natural language commands
   - Swipe-to-confirm execution
   - Rollback demonstration

BLOG POST:
Create builder.aws.com post covering:
- Problem: Chinese restaurant owners struggle with delivery platform fragmentation
- Solution: AI-powered operations partner with Nova
- Impact: Time savings, revenue optimization
- Technical implementation highlights
```

---

## 六、快速修复脚本

### 立即执行的最小修复

```bash
cd /home/claude/restaurantiq-amazon

# Fix model names
sed -i "s/gpt-4.1-mini/gpt-4o-mini/g" lib/server/llm/provider-json.ts
sed -i "s/claude-3-7-sonnet-latest/claude-3-5-sonnet-latest/g" lib/server/llm/provider-json.ts

# Commit
git add -A
git commit -m "fix: correct LLM model names for production"
```

---

## 七、评委关注点 Checklist

| 评审要点 | 当前状态 | 修复优先级 |
|---------|---------|-----------|
| ✅ 使用 Nova 基础模型 | 部分 (有代码但未激活) | P0 |
| ❌ 使用 Nova Act | 缺失 | P0 |
| ❌ 使用 Nova 2 Sonic | 缺失 | P1 |
| ✅ 解决真实问题 | 是 - 中餐馆运营 | - |
| ✅ 创新性 | 高 - AI Agent架构 | - |
| 🟡 演示完整性 | 70% | P1 |
| 🟡 代码质量 | 良好 | - |
| ❌ 博客文章 | 缺失 | P2 |

---

## 八、部署命令参考

```bash
# SSH to server
ssh -i ~/.ssh/restaurantiq.pem ubuntu@34.220.87.202

# Deploy
cd /var/www/restaurantiq
git pull origin main
npm run build
pm2 restart all

# Check logs
pm2 logs --lines 100
```

---

**结论**: RestaurantIQ 有获胜潜力，但需要在 24 小时内完成上述 Critical 修复和 Nova Act 集成。垂直领域深度和 Agent 架构是核心竞争力，关键是要让 Amazon Nova 成为真正的技术核心而非边缘集成。
