# Uber Eats 订单中心修复和升级开发日志

## 开始时间
2026-03-08

## 分支
`fix/ubereats-order-center`

---

## 问题分析

### 1. "Uber Eats token missing" 错误

**错误来源：**
- `lib/server/delivery-order-actions.ts:158`
- `lib/server/delivery-order-query.ts:282`

**根本原因：**
当以下情况同时发生时触发：
1. OAuth flow 未完成或 token 过期
2. `UBEREATS_BEARER_TOKEN` 环境变量未配置
3. `UBEREATS_CLIENT_ID` / `UBEREATS_CLIENT_SECRET` 未正确配置

**Token 解析流程：**
```typescript
// lib/server/delivery-order-actions.ts:104-110
function resolveUberToken(userKey: string) {
  return (
    getUberEatsConnectionState(userKey)?.accessToken ||
    process.env.UBEREATS_BEARER_TOKEN ||
    ''
  );
}
```

### 2. "Invalid status transition: cancelled -> preparing" 错误

**错误来源：**
- `lib/server/delivery-management-store.ts:396-404`

**根本原因：**
状态机逻辑过于严格，`cancelled` 状态被标记为终端状态，不允许任何转换。

```typescript
export function applyOrderStatusTransition(
  current: DeliveryOrderStatus,
  next: DeliveryOrderStatus
) {
  if (current === 'completed' || current === 'cancelled') return false;  // 这里阻止了所有转换
  const allowed: Partial<Record<DeliveryOrderStatus, DeliveryOrderStatus[]>> = {
    new: ['accepted', 'cancelled'],
    accepted: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['completed', 'cancelled'],
  };
  return (allowed[current] || []).includes(next);
}
```

**问题场景：**
1. Uber Eats 可能发送状态更新事件与本地状态不同步
2. 用户误操作取消订单后无法恢复
3. 系统重启或数据不一致时无法恢复状态

### 3. "Webhook 实时推送失败" - 无法接收新订单

**Webhook 端点：** `app/api/webhooks/ubereats/route.ts`

**可能原因：**
1. Uber Developer Dashboard 中 Webhook URL 未正确配置
2. 签名验证失败 - `UBEREATS_WEBHOOK_SIGNING_KEY` 未配置
3. Webhook 事件只是存储，未触发订单创建
4. OAuth scope 未包含 `eats.store.orders.read`

**Uber Eats Webhook 文档参考：**
- 端点：需要在 Developer Dashboard 配置 Primary Webhook URL
- 签名：`X-Uber-Signature` 头（HMAC-SHA256）
- 事件类型：`orders.notification`（新订单创建时发送）
- 响应要求：必须在 200ms 内返回 200 状态码
- 订单接受时间限制：11.5 分钟内必须响应 accept/deny

---

## Uber Eats API 状态机（官方）

根据 Uber Eats API 文档，订单状态流程为：

```
new (created) -> accepted -> preparing -> ready -> completed
                    ↓           ↓          ↓
                 cancelled   cancelled   cancelled
```

---

## 待修复任务

### Phase 1: 紧急修复

- [ ] 修复 token 解析逻辑，添加更好的错误提示
- [ ] 添加 token 自动刷新机制
- [ ] 修复状态转换逻辑，处理边缘情况
- [ ] 增强 webhook 事件处理，确保新订单能正确创建
- [ ] 添加 webhook 事件到订单状态同步

### Phase 2: UI/UX 优化

参考 Deliverect / Otter / StreamOrder 最佳实践：

- [ ] 订单看板视觉优化
- [ ] 一键操作按钮优化
- [ ] 实时更新和通知
- [ ] 错误提示和恢复建议
- [ ] 移动端优化
- [ ] 订单优先级指示

### Phase 3: 菜单管理升级

- [ ] 添加手动创建菜单功能
- [ ] 添加图片上传（OCR 解析）
- [ ] 添加文档上传（PDF, Excel）
- [ ] 集成 AI 菜单解析服务
- [ ] 平台特定菜单同步
- [ ] 菜单预览和编辑

---

## 环境变量要求

### 必需（最小配置）
```
UBEREATS_CLIENT_ID=xxx
UBEREATS_CLIENT_SECRET=xxx
UBEREATS_ORDER_ACTION_ENDPOINT_TEMPLATE=https://api.uber.com/v1/eats/orders/{orderId}/status
UBEREATS_WEBHOOK_SIGNING_KEY=xxx
```

### 推荐（完整功能）
```
UBEREATS_CLIENT_ID=xxx
UBEREATS_CLIENT_SECRET=xxx
UBEREATS_ASYMMETRIC_KEY_ID=xxx
UBEREATS_PRIVATE_KEY_PEM=xxx
UBEREATS_ORDER_ACTION_ENDPOINT_TEMPLATE=https://api.uber.com/v1/eats/orders/{orderId}/status
UBEREATS_STORE_IDS=store_id_1,store_id_2
UBEREATS_WEBHOOK_SIGNING_KEY=xxx
```

---

## 参考资料

- [Uber Eats API Change Log](https://developer.uber.com/docs/eats/api-change-log)
- [Uber Eats Webhooks Guide](https://developer.uber.com/docs/eats/guides/webhooks)
- [Order Notification Webhook](https://developer.uber.com/docs/eats/references/api/webhooks.orders-notification)

---

## 变更历史

### 2026-03-08 - Phase 1: 紧急修复完成
- 创建备份分支 `fix/ubereats-order-center`
- 分析三个主要问题
- 开始修复准备

**已修复的问题：**

1. **Uber Eats Token Missing 错误** (`lib/server/delivery-order-actions.ts`, `lib/server/delivery-order-query.ts`)
   - 增强 `resolveUberToken()` 函数，添加详细的调试信息
   - 更好的错误消息显示配置状态
   - 支持多种 token 来源（OAuth、bearer token）

2. **Status Transition Logic** (`lib/server/delivery-management-store.ts`)
   - 允许从 `cancelled` 状态恢复
   - 处理 Uber webhook 状态同步
   - 改进状态机逻辑以处理边缘情况

3. **Webhook 实时推送** (`app/api/webhooks/ubereats/route.ts`)
   - 解析订单通知事件并创建订单
   - 将 webhook 订单合并到 delivery management state
   - 添加控制台日志记录用于调试
   - 正确处理订单创建/更新

### 2026-03-08 - Phase 2: 菜单管理增强
**新增功能：**

1. **菜单上传能力** (`app/api/menu/upload/route.ts`)
   - 手动输入表单，带验证
   - 图片上传（JPEG, PNG, WebP, GIF）- OCR 占位符
   - 文档上传（PDF, Excel, CSV）带解析支持
   - AI 基于菜单解析服务集成

2. **菜单同步 API** (`app/api/menu/sync/route.ts`)
   - 支持将菜单项同步到 Uber Eats
   - 为其他平台预留同步接口
   - 同步结果和错误处理

3. **增强的菜单管理 UI** (`components/delivery/MenuManagementClientEnhanced.tsx`)
   - 新工作区：上传和同步
   - 文件上传支持拖放
   - 解析项预览和选择
   - 平台特定同步与结果显示

4. **声音通知 Hook** (`hooks/useOrderSoundNotification.ts`)
   - 基于 Web Audio API 的通知声音
   - 浏览器通知 API 集成
   - 防抖动以避免频繁通知

**UI/UX 改进（基于 Deliverect/Otter/StreamOrder）：**
- 清晰的工作流分离
- 所有操作的视觉反馈
- 可操作的错误消息
- 移动端优化（大触摸目标）

