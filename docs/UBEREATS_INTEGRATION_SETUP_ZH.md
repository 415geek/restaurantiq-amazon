# Uber Eats 接入配置说明（中文）

## 目标
- 把 Uber Eats 作为首个外卖平台接入。
- 在第三方平台未完全打通前，继续保留“上传文件分析”方案。

## 必填环境变量（服务端）
在 `.env.local`（本地）或服务器环境变量中配置：

```bash
UBEREATS_CLIENT_ID=...
UBEREATS_ASYMMETRIC_KEY_ID=...
UBEREATS_PRIVATE_KEY_PEM=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
# 或者使用下面两种之一
UBEREATS_PRIVATE_KEY_BASE64=...
UBEREATS_PRIVATE_KEY_PATH=/absolute/path/to/private-key.pem
```

可选（OAuth 鉴权细项）：

```bash
# OAuth 模式（推荐）
UBEREATS_USE_SERVER_TOKEN=false
UBEREATS_OAUTH_AUTHORIZE_URL=https://auth.uber.com/oauth/v2/authorize
UBEREATS_OAUTH_TOKEN_URL=https://auth.uber.com/oauth/v2/token
UBEREATS_OAUTH_SCOPES=eats.store.orders.read eats.store.read
UBEREATS_CLIENT_ASSERTION_AUDIENCE=auth.uber.com
UBEREATS_OAUTH_USE_CLIENT_ASSERTION=true

# 回退：如果你暂时不用 client_assertion，可配置 client_secret
UBEREATS_CLIENT_SECRET=...

# Server Token 模式（临时联调）
UBEREATS_BEARER_TOKEN=...
UBEREATS_USE_SERVER_TOKEN=true
```

可选（用于 Agent A 自动拉单）：

```bash
UBEREATS_STORE_IDS=store_1,store_2
UBEREATS_API_BASE_URL=https://api.uber.com
UBEREATS_STORES_ENDPOINT=
UBEREATS_ORDERS_ENDPOINT_TEMPLATE=
UBEREATS_WEBHOOK_SIGNING_KEY=
```

说明：
- `UBEREATS_ORDERS_ENDPOINT_TEMPLATE` 支持占位符：
  - `{storeId}`
  - `{start}`
  - `{end}`

可选（用于菜单管理中的 Store Ops 推拉）：

```bash
UBEREATS_STORE_STATUS_ENDPOINT_TEMPLATE=/v1/eats/stores/{storeId}/status
UBEREATS_STORE_HOLIDAYHOURS_ENDPOINT_TEMPLATE=/v1/eats/stores/{storeId}/holidayhours
UBEREATS_STORE_POSDATA_ENDPOINT_TEMPLATE=/v1/eats/stores/{storeId}/pos_data
UBEREATS_MENU_GET_ENDPOINT_TEMPLATE=/v2/eats/stores/{storeId}/menu
UBEREATS_MENU_PUT_ENDPOINT_TEMPLATE=/v2/eats/stores/{storeId}/menu
UBEREATS_PROMOTIONS_ENDPOINT=
UBEREATS_INTEGRATOR_STORE_ID=
```

说明：
- `Store Ops` 会统一推送：
  - 常规营业时间（`service_availability`）
  - 假期覆盖时间（`holidayhours`）
  - 在线状态（`status`）
  - 备餐参数（`pos_data`）
- 若未配置 `UBEREATS_PROMOTIONS_ENDPOINT`，促销仅保留本地草稿，不阻断其他配置推送。

## OAuth 回调地址
在 Uber 开发者平台中配置回调地址：

```text
https://restaurantiq.ai/api/integrations/ubereats/callback
```

## 后端接口
- 发起授权：`GET /api/integrations/ubereats/start`
- 回调处理：`GET /api/integrations/ubereats/callback`
- 状态查询：`GET /api/integrations/ubereats/status`
- Webhook 接收：`POST /api/webhooks/ubereats`
- Webhook 事件查看（内部调试）：`GET /api/webhooks/ubereats?limit=20`
- Store Ops 拉取/推送：`GET|PATCH /api/delivery/store-ops`

## 与分析链路的关系
- 当 Uber Eats 已连接且可拉取订单时：会自动注入 Agent A 输入（`source=ubereats_api`）。
- 当 Uber Eats 未连接或拉取失败时：不会阻断分析，系统继续使用 `manual_upload` 文件数据。

## 验证步骤
1. 打开 `/settings`，点击 `Connect Uber Eats`。
2. 查看 `/api/integrations/ubereats/status`，确认 `connected=true`。
3. 在 Uber Developer Dashboard 配置 Webhook URL：
   - `https://restaurantiq.ai/api/webhooks/ubereats`
4. 用 Uber sandbox 事件触发后，访问 `/api/webhooks/ubereats?limit=20` 能看到事件。
5. 在 `/analysis` 上传运营文件并提交分析。
6. 检查建议结果是否同时包含上传数据与 Uber Eats 数据信号。
7. 打开 `/menu-management`：
   - 在 Store Ops 点击「从 Uber 拉取」确认线上配置可读取；
   - 修改营业时间/假期/在线状态/备餐参数后点击「推送到 Uber」；
   - 核对“同步告警”和“推送回执”。
