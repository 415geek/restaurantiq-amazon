# Uber Eats SaaS MVP 实施计划

## 项目概述

本文档定义了完整的Uber Eats深度集成MVP实施计划，包括门店管理、营业时间、在线状态和促销配置。

---

## 技术栈决策

### 后端选项

| 技术栈 | 优势 | 劣势 | 推荐度 |
|---------|------|------|--------|
| **Node.js (Next.js API Routes)** | - 已有代码基础<br>- 统一技术栈<br>- 更好的类型安全 | - 复杂集成可能影响性能<br>- OAuth流程需要单独处理 | ⭐⭐⭐⭐ |
| **Python + FastAPI** | - Uber Eats SDK支持更好<br>- 异步处理能力强<br>- Python生态系统丰富 | - 需要额外的服务部署<br>- 技术栈分裂 | ⭐⭐⭐ |
| **Python + Streamlit (后台管理)** | - 快速开发UI<br>- 适合数据管理工具<br>- 与API服务分离 | - 不适合面向用户的前端<br>- 实时性能较差 | ⭐⭐⭐ |

### 推荐方案：**混合架构**
```
┌─────────────────────────────────────────────────────────────────┐
│                   用户前端 (Next.js)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│ │ 订单中心      │ │ 菜单管理    │ │ 设置中心      │   │
│ └─────────────┘  └─────────────┘  └─────────────┘   │
│                  │                │                │               │
├─────────────────────────────────────────────────────────────────┤
│                   Next.js API Routes (现有)                │
├─────────────────────────────────────────────────────────────────┤
│                   Uber Eats SDK Service (新增)               │
└─────────────────────────────────────────────────────────────────┘
```

**理由：**
1. 保持现有Next.js代码库，避免技术栈分裂
2. Uber Eats SDK主要支持Node.js，Python集成需要额外工作
3. 后台管理可以用Streamlit快速开发，独立部署

---

## 核心数据模型

### 1. 门店数据 (Store)

```typescript
interface Store {
  id: string;                      // Uber Eats store_id
  name: string;                    // 门店名称
  address: StoreAddress;
  status: 'online' | 'offline' | 'paused';
  posData: StorePOSData;
  configuration: StoreConfiguration;
  integrationStatus: StoreIntegrationStatus;
  lastSyncAt: string;
  syncedAt: string;
}
```

### 2. 营业时间 (BusinessHours)

```typescript
interface RegularHours {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;  // HH:MM 格式，如 "11:00"
  end_time: string;    // HH:MM 格式，如 "21:00"
  is_closed: boolean;
}

interface HolidayHours {
  holiday_date: string;  // YYYY-MM-DD 格式
  start_time?: string;
  end_time?: string;
  is_closed: boolean;
  reason?: string;
}

interface PrepTimeConfig {
  menu_item_id?: string;  // 菜单项级别
  category_id?: string;      // 分类级别
  store_id?: string;       // 门店级别全局偏移
  prep_minutes: number;       // 备餐时间（分钟）
}
```

### 3. 门店配置 (StoreConfiguration)

```typescript
interface StoreConfiguration {
  regular_hours: RegularHours[];
  holiday_hours: HolidayHours[];
  prep_time: PrepTimeConfig[];
}
```

### 4. POS数据 (StorePOSData)

```typescript
interface StorePOSData {
  online_status: 'online' | 'offline' | 'paused';
  integration_enabled: boolean;  // 必须为true才能接单
  integration_status: 'not_requested' | 'pending' | 'connected' | 'failed';
  integrator_store_id: string;  // 你的唯一门店ID
  store_configuration_data?: {
    service_availability?: RegularHours[];
    menu_prep_time?: PrepTimeConfig[];
    holiday_hours?: HolidayHours[];
  };
  last_updated_at: string;
}
```

### 5. 促销配置 (Promotion)

```typescript
interface Promotion {
  id: string;
  store_id: string;
  name: string;
  type: 'discount' | 'buy_one_get_one' | 'spend_x_get_y' | 'free_delivery';
  discount_type?: 'percentage' | 'fixed_amount';
  discount_value?: number;
  min_order_amount?: number;
  max_order_amount?: number;
  start_date: string;
  end_date?: string;
  status: 'active' | 'inactive' | 'scheduled';
  menu_item_ids?: string[];  // 关联的菜单项
  apply_to_all_items?: boolean;  // 是否应用到所有菜品
  timezone?: string;
  created_at: string;
  updated_at: string;
}
```

---

## API 端点设计

### 1. Uber Eats OAuth 流程

```
┌────────────────────────────────────────────────────────────────────────┐
│  步骤1: 用户点击"连接 Uber Eats"                              │
│           ↓                                                      │
│  步骤2: 重定向到 Uber OAuth 授权页面                         │
│           ↓                                                      │
│  步骤3: 用户授权后，Uber 重定向回 callback URL             │
│           ↓                                                      │
│  步骤4: 解析授权码，交换获取 access_token                   │
│           ↓                                                      │
│  步骤5: 保存 token，更新状态，重定向回订单中心               │
└────────────────────────────────────────────────────────────────────────┘

GET  /api/ubereats/auth/start
  - 生成授权URL
  - 返回302重定向到 Uber

GET  /api/ubereats/auth/callback
  - 接收Uber的回调
  - 交换授权码获取token
  - 保存到数据库
  - 重定向回 /delivery?status=connected
```

### 2. 门店管理 API

```typescript
// 获取所有门店
GET  /api/stores
Response: Store[]

// 获取单个门店详情
GET  /api/stores/:storeId
Response: { store: Store; integrationStatus: StoreIntegrationStatus; configuration: StoreConfiguration; }

// 更新门店营业时间
PUT  /api/stores/:storeId/business-hours
Body: { regular_hours: RegularHours[]; holiday_hours: HolidayHours[] }

// 更新门店在线状态
PATCH  /api/stores/:storeId/status
Body: { status: 'online' | 'offline' | 'paused' }

// 同步到Uber Eats
POST  /api/stores/:storeId/sync
Response: { synced: boolean; warnings: string[] }
```

### 3. 菜单 API (扩展)

```typescript
// 扩展现有的菜单项，添加门店特定配置
PATCH  /api/menu/items/:itemId/store-config
Body: {
  prep_minutes?: number;
  uber_eats_item_id?: string;  // 映射到Uber Eats菜单项ID
}

// 批量更新菜单项
PUT  /api/menu/items/batch/store-config
Body: { items: Array<{ id: string; store_config: StoreItemConfig }> }
```

### 4. 促销 API

```typescript
// 获取所有促销
GET  /api/promotions?storeId=:storeId
Response: Promotion[]

// 创建促销
POST  /api/promotions
Body: PromotionCreateRequest

// 更新促销
PATCH  /api/promotions/:promotionId
Body: Partial<Promotion>

// 删除促销
DELETE  /api/promotions/:promotionId

// 同步到Uber Eats
POST  /api/promotions/:promotionId/sync
Response: { synced: boolean; uber_promotion_id?: string }
```

---

## 实施阶段

### Phase 1: OAuth 集成 (1-2周)

#### 1.1 OAuth 服务实现

**文件：** `lib/server/ubereats-oauth-service.ts` (新建)

```typescript
export class UberEatsOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.UBEREATS_CLIENT_ID!;
    this.clientSecret = process.env.UBEREATS_CLIENT_SECRET!;
    this.redirectUri = process.env.NEXT_PUBLIC_APP_URL + '/api/ubereats/auth/callback';
  }

  // 生成授权URL
  async generateAuthUrl(storeId?: string, scopes?: string[]): Promise<string> {
    const state = Buffer.from(JSON.stringify({
      storeId,
      redirect: '/delivery',
      timestamp: Date.now(),
    })).toString('base64');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state,
      scope: scopes?.join(' ') || 'eats.store.read eats.store.orders.write eats.store.status.write',
    });

    const authUrl = `${process.env.UBEREATS_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
    return authUrl;
  }

  // 处理OAuth回调
  async handleCallback(code: string, state: string): Promise<OAuthResult> {
    try {
      const params = new URLSearchParams();
      params.set('grant_type', 'authorization_code');
      params.set('code', code);
      params.set('redirect_uri', this.redirectUri);
      params.set('client_id', this.clientId);

      const tokenResponse = await fetch(process.env.UBEREATS_OAUTH_TOKEN_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        },
        body: params.toString(),
      });

      const tokenData = await tokenResponse.json();

      return {
        success: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

**API端点：**
- `app/api/ubereats/auth/start/route.ts`
- `app/api/ubereats/auth/callback/route.ts`

#### 1.2 OAuth UI 组件

**文件：** `components/ubereats/UberEatsAuthModal.tsx` (新建)

- 弹窗模态组件
- 显示Uber Eats授权说明
- 处理授权成功后的重定向

#### 1.3 Token 存储

**文件：** `lib/server/ubereats-oauth-persistence.ts` (新建)

- 使用现有的 `ubereats-oauth-store.ts`
- 添加持久化到数据库（可选，使用Clerk user metadata）

---

### Phase 2: 门店数据管理 (2-3周)

#### 2.1 数据库Schema

**PostgreSQL Schema (推荐)：**

```sql
-- 门店表
CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  uber_eats_store_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline',
  pos_data JSONB NOT NULL DEFAULT '{}',
  configuration JSONB NOT NULL DEFAULT '{}',
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_stores_user_id ON stores(user_id);
CREATE INDEX idx_stores_uber_store_id ON stores(uber_eats_store_id);

-- 门店营业时间表
CREATE TABLE store_regular_hours (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  start_time TEXT NOT NULL, -- HH:MM
  end_time TEXT NOT NULL,    -- HH:MM
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_store_regular_hours_store_id ON store_regular_hours(store_id);

-- 门店假期表
CREATE TABLE store_holiday_hours (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL UNIQUE,
  start_time TEXT, -- HH:MM (optional)
  end_time TEXT,   -- HH:MM (optional)
  is_closed BOOLEAN DEFAULT FALSE,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_store_holiday_hours_store_id ON store_holiday_hours(store_id);

-- 促销表
CREATE TABLE promotions (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
  uber_promotion_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  discount_type TEXT,
  discount_value NUMERIC,
  min_order_amount NUMERIC,
  max_order_amount NUMERIC,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active',
  menu_item_ids TEXT[], -- array of menu item IDs
  timezone TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_promotions_store_id ON promotions(store_id);
CREATE INDEX idx_promotions_status ON promotions(status);
```

#### 2.2 Uber Eats SDK 集成

**安装：**
```bash
npm install @uber-eats/node-sdk
```

**文件：** `lib/server/ubereats-client.ts` (新建)

```typescript
import UberEats from '@uber-eats/node-sdk';

export class UberEatsClient {
  private client: UberEats;

  constructor(authToken: string, sandbox: boolean = false) {
    this.client = new UberEats({
      authToken,
      clientId: process.env.UBEREATS_CLIENT_ID!,
      clientSecret: process.env.UBEREATS_CLIENT_SECRET!,
      sandbox,
    });
  }

  // 获取所有门店
  async getStores() {
    return await this.client.store.listAll();
  }

  // 更新营业时间
  async updateBusinessHours(storeId: string, regularHours: RegularHours[]) {
    // Uber Eats service_availability 格式
    const availability = regularHours.map(h => ({
      day: h.day,
      periods: [{
        start_time: h.start_time.substring(0, 5), // HH:MM:SS
        end_time: h.end_time.substring(0, 5),  // HH:MM:SS
      }],
    }));

    return await this.client.store.setServiceAvailability(storeId, availability);
  }

  // 设置假期
  async setHolidayHours(storeId: string, holidayHours: HolidayHours[]) {
    // Uber Eats holiday_hours 格式
    const holidays = holidayHours.map(h => ({
      holiday_date: h.holiday_date,
      periods: [{
        start_time: h.start_time ? h.start_time.substring(0, 5) + '00:00' : '00:00:00',
        end_time: h.end_time ? h.end_time.substring(0, 5) + '23:59:59' : '23:59:59',
      }],
    }));

    return await this.client.store.setHolidayHours(storeId, holidays);
  }

  // 更新门店状态
  async setStoreStatus(storeId: string, status: 'online' | 'offline' | 'paused') {
    return await this.client.store.updateStatus(storeId, status);
  }

  // 创建促销
  async createPromotion(storeId: string, promotion: Promotion): Promise<string> {
    // Uber Eats Promotions API
    const uberPromotion = await this.client.promotions.create({
      store_id: storeId,
      name: promotion.name,
      start_date: promotion.start_date,
      end_date: promotion.end_date,
      // 根据类型设置不同参数
      ...(promotion.type === 'discount' && { discount: { type: promotion.discount_type, value: promotion.discount_value } }),
      ...(promotion.type === 'buy_one_get_one' && { buy_one_get_one: { eligible_item_ids: promotion.menu_item_ids } }),
    });

    return uberPromotion.id;
  }

  // 同步菜单
  async syncMenu(storeId: string, menuItems: any[]) {
    // Upload menu to Uber Eats
    return await this.client.menu.upsert(storeId, menuItems);
  }
}
```

---

### Phase 3: 门店管理 UI (2-3周)

#### 3.1 门店列表组件

**文件：** `components/stores/StoreManagementClient.tsx` (新建)

- 门店列表视图
- 营业时间编辑器
- 在线状态切换
- 同步状态显示

#### 3.2 营业时间配置组件

**文件：** `components/stores/BusinessHoursEditor.tsx` (新建)

- 拖拽式时间编辑器
- 一周7天快速配置
- 复制/粘贴功能

#### 3.3 促销管理组件

**文件：** `components/stores/PromotionsClient.tsx` (新建)

- 促销创建/编辑表单
- 促销列表视图
- 日期范围选择器
- 关联菜单项选择器

---

### Phase 4: 集成与测试 (1-2周)

#### 4.1 数据迁移

- 从现有存储迁移到数据库
- 保持OAuth token同步

#### 4.2 端到端测试

- 测试所有API端点
- 验证Uber Eats SDK调用
- 端到端用户体验测试

---

## 环境变量配置

```bash
# Uber Eats OAuth
UBEREATS_CLIENT_ID=your_client_id
UBEREATS_CLIENT_SECRET=your_client_secret
UBEREATS_OAUTH_AUTHORIZE_URL=https://auth.uber.com/oauth/v2/authorize
UBEREATS_OAUTH_TOKEN_URL=https://auth.uber.com/oauth/v2/token
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Uber Eats SDK 配置
UBEREATS_SANDBOX=false  # 测试环境设为true
```

---

## MVP 功能清单

### 功能优先级

| 优先级 | 功能 | 复杂度 | 预估工作量 |
|--------|------|--------|------------|
| P0 | OAuth 授权流程 | 中 | 3天 |
| P0 | 门店列表与状态切换 | 低 | 2天 |
| P0 | 基础营业时间配置 | 中 | 3天 |
| P1 | 假期时间配置 | 低 | 1天 |
| P1 | 门店在线状态更新 | 低 | 1天 |
| P2 | 简单促销管理（百分比折扣） | 中 | 4天 |
| P2 | 备餐时间配置 | 中 | 2天 |
| P2 | 促销同步到Uber Eats | 高 | 5天 |

---

## 下一步行动

### 需要您确认的内容

1. **技术栈选择**
   - [ ] 使用纯 Next.js + Uber Eats SDK（推荐）
   - [ ] 使用 Python FastAPI 后端 + Next.js 前端
   - [ ] 需要Streamlit后台管理工具

2. **数据库选择**
   - [ ] 使用 PostgreSQL（推荐）
   - [ ] 使用 SQLite（开发阶段）
   - [ ] 使用现有的文件系统存储（简单部署）

3. **实施优先级**
   - 请确认优先级 P0 功能是否都需要Phase 1完成
   - 还是可以先完成OAuth，然后并行开发其他功能

4. **开发资源**
   - 预计需要 2-3 个开发工程师
   - 建议分工：1人负责OAuth + SDK集成，1人负责门店管理，1人负责促销

### 立即可以开始的工作

1. 创建 GitHub issue 跟踪这个MVP
2. 创建新的开发分支：`feature/store-management-mvp`
3. 搭建本地数据库开发环境
4. 开始OAuth服务实现

---

## 参考资料

- [Uber Eats API Change Log](https://developer.uber.com/docs/eats/api-change-log)
- [Uber Eats Store API](https://developer.uber.com/docs/eats/references/api/v1/get-eats-stores-storeid)
- [Uber Eats Business Hours](https://developer.uber.com/docs/eats/references/api/v1/put-eats-stores-storeid-serviceavailability)
- [Uber Eats Holiday Hours](https://developer.uber.com/docs/eats/references/api/v1/post-eats-stores-storeid-holidayhours)
- [Uber Eats Promotions API](https://developer.uber.com/docs/eats/references/api/v2/promotions-suite)
- [Uber Eats Menu API](https://developer.uber.com/docs/eats/references/api/v2/get-eats-stores-storeid-menu)
- [Uber Eats Node SDK](https://github.com/Uber/ubereats-node-sdk)
