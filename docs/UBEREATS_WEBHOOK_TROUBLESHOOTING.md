# Uber Eats 订单实时推送收不到 — 排查指南

## 原因概览

后台「收不到」订单推送通常由以下几类问题导致：

1. **Webhook 订单写入了错误用户**（已通过配置修复）
2. **Uber Developer 未配置或未验证 Webhook URL**
3. **签名校验失败**（401）
4. **未订阅订单类事件**
5. **服务器 .runtime 不可写或接口 5xx**

---

## 1. Webhook 订单归属到「后台账号」（必配）

**问题**：Webhook 请求没有登录态，订单被写入 `anonymous`；后台用**登录用户的 userId** 读订单，所以看不到推送的订单。

**处理**：用环境变量指定「接收 webhook 的账号」的 Clerk User ID，让推送订单写入该账号的状态，登录该账号即可在配送/订单页看到。

| 变量 | 说明 |
|------|------|
| `UBEREATS_WEBHOOK_USER_KEY` | Clerk 的 `userId`（即后台登录账号的 ID）。Webhook 收到的订单会合并到该 userKey 对应的状态里。 |

**配置步骤**：

1. 在 [Clerk Dashboard](https://dashboard.clerk.com) 或你的用户表里，找到**要看到实时订单的那个后台账号**，复制其 **User ID**（例如 `user_xxx`）。
2. 在服务器和本地的 `.env.local` 中增加：
   ```bash
   UBEREATS_WEBHOOK_USER_KEY=user_你的后台账号ID
   ```
3. 重启应用（本地 `npm run dev`，服务器 `pm2 restart iqproject --update-env`）。
4. 用该账号登录后台，在「配送 / 订单」页应能看到 Uber 推送的新订单。

不配置时行为不变：订单仍写入 `anonymous`，只有访问「匿名」状态时才会看到（当前后台不会用该状态）。

---

## 2. Uber Developer 配置 Webhook

- 登录 [Uber Developer Dashboard](https://developer.uber.com/dashboard)，进入你的 **Uber Eats** 应用。
- 找到 **Webhooks** 或 **Notifications** 配置项。
- **Webhook URL** 填：
  ```text
  https://restaurantiq.ai/api/webhooks/ubereats
  ```
  （本地调试可用 ngrok 等暴露 `http://localhost:3000/api/webhooks/ubereats`，并在此处填 ngrok 的 HTTPS 地址。）
- 若 Dashboard 提供 **Webhook Secret / Signing Secret**，复制下来，用于下一步的签名校验。
- 订阅与订单相关的事件，例如：
  - `orders.notification`
  - `orders.cancel`
  - `orders.failure`
  - `orders.scheduled.notification`  
  （具体名称以 Uber 文档为准。）

保存后 Uber 会向该 URL 发送验证或测试请求；若返回非 2xx，Uber 可能不会启用推送。

---

## 3. 签名校验（401 Invalid signature）

项目使用 **HMAC-SHA256** 校验 `x-uber-signature`（或 `x-uber-signature-sha256` / `uber-signature`）。  
签名密钥读取顺序：**`UBEREATS_WEBHOOK_SIGNING_KEY`** → 若未配置则用 **`UBEREATS_CLIENT_SECRET`**。

**检查**：

- 若 Uber Dashboard 提供了 **Webhook Signing Secret**，应在服务器/本地配置：
  ```bash
  UBEREATS_WEBHOOK_SIGNING_KEY=与 Dashboard 中完全一致的 secret
  ```
- 若用 Client Secret 作为签名密钥，则 Dashboard 中应使用同一 Client Secret 签名，且本环境已正确配置 `UBEREATS_CLIENT_SECRET`。
- 若暂时不校验签名（仅用于调试），可去掉或注释校验逻辑（**生产环境不建议关闭**）。

401 时 Uber 可能重试；可在服务器上查看接口日志确认是否为 `invalid_signature` 或 `missing_signature_header`。

---

## 4. 事件类型与 topic

当前逻辑只把「订单相关」事件合并进订单列表：`topic` / `event_type` 中包含 `order` 且包含 `notification` / `cancel` / `failure` / `scheduled` 等。  
若 Uber 使用其它 topic 名称，可能只会出现在「事件流」里而不会进入订单列表；可根据日志中的 `topic` / `eventType` 对照 [Uber Eats Webhook 文档](https://developer.uber.com/docs/eats/webhooks) 调整 `isOrderNotificationEvent` 或事件订阅。

---

## 5. 服务器可写性与 5xx

- Webhook 会将原始事件写入 **`.runtime/ubereats/webhook-events.json`**。  
  确保应用进程对项目目录下的 `.runtime` 有写权限（例如 PM2 以 `ubuntu` 运行，则 `~/iqproject/.runtime` 需可写）。
- 若写入失败会抛错并返回 5xx，Uber 可能重试或停推；可查看 `pm2 logs iqproject` 是否有写文件或 JSON 解析错误。

---

## 快速检查清单

- [ ] 已设置 `UBEREATS_WEBHOOK_USER_KEY` 为后台账号的 Clerk User ID，并重启应用。
- [ ] Uber Developer 中 Webhook URL 为 `https://restaurantiq.ai/api/webhooks/ubereats`（或你的域名）。
- [ ] 已订阅订单相关事件（如 `orders.notification` 等）。
- [ ] 若 Dashboard 有 Signing Secret，已配置 `UBEREATS_WEBHOOK_SIGNING_KEY`（或确认用 `UBEREATS_CLIENT_SECRET` 且一致）。
- [ ] 服务器上 `.runtime` 可写，接口无 5xx；必要时查看 `pm2 logs iqproject` 和「事件流」是否收到事件。

---

## 相关代码与配置

- Webhook 入口：`app/api/webhooks/ubereats/route.ts`（POST 接收推送，GET 可查最近事件）。
- 订单合并：`mergeWebhookOrderToState(userKey, ...)`，`userKey` 来自 `UBEREATS_WEBHOOK_USER_KEY` 或 `auth().userId` 或 `'anonymous'`。
- 事件存储：`lib/server/ubereats-webhook-store.ts`（`.runtime/ubereats/webhook-events.json`）。
- 配送状态按 userKey 存储：`lib/server/delivery-management-store.ts`。
