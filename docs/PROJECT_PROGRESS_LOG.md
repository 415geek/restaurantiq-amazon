# IQproject 研发交接进度文档（中文版）

- 文档生成时间：2026-03-06 13:15:00 PST
- 适用对象：新加入项目的研发同学（前端/后端/全栈）
- 目标：无需口头补充即可快速接手开发与上线

## 1. 项目与部署基础信息

### 1.1 线上域名
- 主站：`https://restaurantiq.ai`
- 登录：`https://restaurantiq.ai/sign-in`
- 注册：`https://restaurantiq.ai/sign-up`

### 1.2 服务器信息
- 云厂商：AWS Lightsail
- 服务器 IP：`34.220.87.202`
- 登录用户：`ubuntu`
- SSH Key（本地）：`/Users/c8geek/Downloads/LightsailDefaultKey-us-west-2 (5).pem`
- 项目目录（服务器）：`~/iqproject`
- 进程管理：`pm2`
- PM2 应用名：`iqproject`

### 1.3 常用运维命令
```bash
# SSH 登录
ssh -i '/Users/c8geek/Downloads/LightsailDefaultKey-us-west-2 (5).pem' ubuntu@34.220.87.202

# 进入项目
cd ~/iqproject

# 构建与重启
npm run build
pm2 restart iqproject --update-env

# 查看进程
pm2 status
pm2 logs iqproject --lines 200
```

### 1.4 环境变量原则
- 真实密钥只放 `~/.env.local`（服务器）
- 仓库仅保留 `.env.example` 占位符
- 前端仅允许 `NEXT_PUBLIC_*` 公共变量

## 2. 里程碑与修改目的（按阶段）

### 阶段 N：Uber 门店运营配置（Store Ops）闭环（2026-03-08）
- 目的：按 Uber 最新接入细则，补齐门店级运营控制闭环，避免“只改菜单不改门店状态”导致线上不一致。
- 关键成果：
  - 新增门店运营配置接口：`GET/PATCH /api/delivery/store-ops`
  - 新增 `lib/server/ubereats-store-ops.ts` 适配层，覆盖：
    - 常规营业时间（`service_availability`）拉取与推送；
    - 假期覆盖时间（`holidayhours`）拉取与推送；
    - 在线状态（`status`）拉取与推送；
    - 备餐参数（`pos_data`）拉取与推送；
    - 促销草稿（Promotions endpoint 未配置时保留本地草稿并给告警）。
  - 菜单管理页新增 Store Ops 可视化面板：
    - 门店选择、在线/暂停切换、备餐偏移与默认备餐时间；
    - 周营业时间编辑、假期覆盖编辑、促销草稿编辑；
    - 一键「从 Uber 拉取 / 保存本地 / 推送到 Uber」；
    - 同步告警与推送回执同页展示。
  - 增加 `integration_enabled` 检测告警，帮助排查 nominated integrator 未绑定问题。

### 阶段 A：生产恢复与官网优化（2026-02-22 ~ 2026-02-23）
- 目的：恢复线上可用性、打通登录路径、提升官网转化与品牌一致性。
- 关键成果：
  - 修复 Clerk host 错误与 DNS 配置问题，恢复真实登录流程。
  - 官网新增/完善：语言切换、Hero 动效、support 邮箱、亮点模块、截图放大、CTA 联动。
  - 品牌统一：替换 Logo/文字 Logo，透明背景与移动端适配。

### 阶段 B：SaaS 控制台 MVP（2026-02-23）
- 目的：从纯展示站升级为可测试的后台产品原型。
- 关键成果：
  - 完成 Dashboard / Analysis / Settings / Account / Social Radar 页面。
  - 建立执行闭环：AI 建议 -> 执行预览 -> 滑动确认 -> 执行状态 -> 回滚倒计时。
  - 建立 mock/live 双模式与 API 分层，保证无 key 也能稳定演示。

### 阶段 C：集成扩展（Yelp/Maps/Weather/Pricing）（2026-02-23 ~ 2026-02-24）
- 目的：让后台具备可连接外部数据源和订阅能力展示。
- 关键成果：
  - Yelp / Google Maps / Weather 接口接入（真实+回退）。
  - Pricing 页面与 Clerk 计划权限演示（`/pricing`, `/billing-access`）。

### 阶段 D：Meta（Facebook/Instagram）接入（2026-02-25 ~ 2026-02-26）
- 目的：允许商家在后台一键连接 Facebook/Instagram，将数据汇总到 Social Radar。
- 关键成果：
  - 增加 Meta OAuth 三段式接口（start/callback/status）与 Settings 连接按钮。
  - 修复 invalid scopes，改为业务登录兼容 scope 集。
  - 新增 Instagram webhook 校验端点，支持 Meta 控制台 Verify and Save。
  - Social Radar 增加 Meta 数据聚合接口，支持 `live` / `live_partial` / `mock`。

### 阶段 E：Google Business + 分析中心上传与多 Agent 框架（2026-02-27）
- 目的：补齐“Google Business 商家账号接入”与“早期无 POS/外卖对接时的手动运营数据上传分析”能力。
- 关键成果：
  - 新增 Google Business Profile OAuth 三段式接口（start/callback/status）。
  - Settings 集成面板新增 `Google Business Profile` 与 `Yelp Partner (Owner Account)` 两项。
  - 将 Yelp 明确区分为两层能力：
    - 公开 Fusion API：查询商家公开数据与评论摘要
    - Partner/OAuth：商家账号托管、统一回复、统一管理（当前未打通，需 Yelp Partner 审批）
  - `Social Radar` 的统一接口补充 Google Business 评分/评论读取，并支持与 Meta 数据混合输出。
  - `Analysis` 页面新增“运营数据上传（Agent A）”模块，支持不限数量、任意格式的手动文件上传。
  - 新增四 Agent 协作框架：
    - Agent A：运营数据清洗 / 解析 / 归类
    - Agent B：社媒与口碑数据结构化
    - Agent C：宏观影响因子结构化
    - Agent D：多 Agent 汇总分析与预测，输出执行建议
  - 当 `OPENAI_API_KEY` 存在时，Agent D 会调用 OpenAI 做结构化综合分析；否则走确定性 fallback，不影响演示。


### 阶段 G：v3 Python Orchestrator 并行服务骨架（2026-02-28）
- 目的：为后续更强的多 Agent orchestration 做隔离式落地，避免直接冲击现有 Next.js 生产逻辑。
- 关键成果：
  - 新增并行服务目录 `restaurantiq-agents/`。
  - 落地 FastAPI + DAG Pipeline + Supervisor + Agent Registry + Snapshot Engine 的第一版运行骨架。
  - 提供 Agent CRUD、Pipeline CRUD、Execution Snapshot、WebSocket 状态流接口。
  - 提供默认标准运营 DAG：A/B/C -> Fusion -> Executors。
  - 新增迁移文档 `docs/MULTI_AGENT_ORCHESTRATION_V3_MIGRATION_ZH.md`，明确 Python 编排服务与当前主站的边界和灰度切流路线。

### 阶段 H：Complete Fix All Agents v3 收口修复（2026-03-01）
- 目的：按 `COMPLETE_FIX_ALL_AGENTS_v3.md` 的要求，把新旧 Agent 兼容层、上传解析链路、OpenAI 编排入口与 v3 orchestration 类型系统收回到“可构建、可继续迭代”的状态。
- 关键成果：
  - 修复 `analysis-orchestrator` 中旧 `validatedPlan` 类型索引导致的构建失败，统一改为消费 `AgentDValidatorResult` 的真实输出结构。
  - 修复 `agent-c-macro` / `agent-d-synthesis` 兼容 shim 对新 `Agent B / C / D` 结果结构的错误引用，避免新链路运行但旧兼容层继续报错。
  - 放宽 `AgentCPlannerResult` 中过于僵硬的字面量类型（如 `time_horizon_days`、`task_board.columns`），让编排层能接受真实领域数据而不是被类型系统锁死。
  - 修复 `Agent D Validator` 的 `data_requests.priority` 归一化逻辑，避免把 `P2` 非法写入只允许 `P0/P1` 的请求优先级字段。
  - 修复 `ops-document-parser` 中可选经营指标使用 `null` 触发的 TypeScript 错误，统一改成 `undefined` 语义。
  - 重跑并通过：
    - `npm run build`
    - `python3 -m compileall restaurantiq-agents/app restaurantiq-agents/tests`
  - 为这轮修复新增备份：
    - git tag：`backup/20260301-153026-before-complete-fix-all-agents-v3`
  - 压缩备份：`_project_backups/iqproject-20260301-153026-before-complete-fix-all-agents-v3.tar.gz`

### 阶段 I：Uber Eats 首个平台接入 + 上传 fallback 保持（2026-03-05）
- 目的：按最新 roadmap 要求，把 Uber Eats 作为首个外卖平台接入，同时保持“未完全打通三方平台时仍可用上传文件分析”的产品连续性。
- 关键成果：
  - 新增 Uber Eats 三段式集成接口：
    - `GET /api/integrations/ubereats/start`
    - `GET /api/integrations/ubereats/callback`
    - `GET /api/integrations/ubereats/status`
  - Settings 集成面板新增 `Uber Eats (Delivery)` 连接按钮、状态检测与中英文接入说明。
  - 新增服务端 Uber Eats 连接状态存储 `lib/server/ubereats-oauth-store.ts`（仅存服务端内存，不暴露到前端）。
  - 分析链路新增 `lib/server/adapters/ubereats-ops.ts`：
    - 若 Uber Eats 已连接且提供订单拉取模板，会自动构造 Agent A 可消费的结构化运营快照；
    - 若第三方数据拉取失败，不中断分析，继续使用上传文件 fallback。
  - `app/api/analysis/route.ts` 已接入上述快照注入逻辑，并保留原上传文件流程。

### 阶段 J：Roadmap Prompt 落地（日报能力）与 Dashboard 升级（2026-03-05）
- 目的：按 `restaurantiq_prompts_library.md` 与 `restaurantiq_mvp_roadmap.md` 的 Tier 1 方向，把“每日运营简报”从文档能力落到可调用代码路径。
- 关键成果：
  - 新增服务端 Prompt Library：
    - `lib/server/prompt-library.ts`
    - 包含 `DAILY_BRIEFING_SYSTEM_PROMPT`、`PRICING_ALERT_SYSTEM_PROMPT`、`RECONCILIATION_REPORT_SYSTEM_PROMPT` 的工程化入口。
  - 新增日报生成器：
    - `lib/server/daily-briefing.ts`
    - 优先使用 OpenAI 结构化输出生成简报；若 key 缺失或调用失败，自动回退到确定性摘要。
  - 新增日报接口：
    - `GET /api/dashboard/daily-briefing`
    - 读取当前用户最新分析运行态（含上传文件/推荐动作）并生成中英文简报。
  - Dashboard 新增“智能日报”卡片：
    - `components/dashboard/DashboardClient.tsx`
    - 显示 `Live/Fallback` 状态与回退告警，满足“先可用、后增强”的 MVP 目标。

### 阶段 K：Conversational Ops（对话式经营执行）P0（2026-03-06）
- 目的：把“聊天输入”升级为“可执行、可审批、可回滚、可审计”的经营动作系统，作为新护城河功能的首期落地。
- 关键成果：
  - 新增 `ops-copilot` 模块：
    - 页面：`/ops-copilot`
    - 导航：Navbar/Sidebar 全局入口
    - 路由保护：未登录不可访问
  - 新增后端执行接口：
    - `GET/POST /api/ops/commands`
    - `GET/PATCH /api/ops/commands/[commandId]`
  - 新增执行状态机与动作流：
    - `awaiting_confirmation -> awaiting_approval -> scheduled -> executing -> synced/partially_failed -> completed/rolled_back/rejected`
  - 新增结构化执行预览：
    - 受影响门店/平台/菜品
    - 变更明细（old/new）
    - 风险提示、审批要求、回滚窗口
  - 新增多平台执行反馈与审计日志：
    - 分平台执行结果（成功/失败）
    - 审计链（创建、确认、审批、执行、回滚）
  - 新增 LLM 供应商路由层（OpenAI/Claude）：
    - 按任务类型选择主/备模型
    - Key 缺失或结构化输出失败时可降级，不阻断流程

### 阶段 L：交互收口（外卖接入流 + 分析上传区折叠）（2026-03-06）
- 目的：按最新体验要求收口页面信息密度，减少首屏干扰，让新用户先完成平台接入再进入复杂运营台。
- 关键成果：
  - `Analysis` 上传区改为默认折叠：
    - 上传后默认显示摘要，不自动展开全部文件卡片；
    - 用户点击“展开已上传”后才查看完整文档清单。
  - `Delivery Management` 首屏重构：
    - 用户首次进入仅看到平台接入卡片；
    - 每个平台卡片仅保留两个按钮：`授权接入` / `取消链接`；
    - 卡片状态统一为“已接入/未连接”；
    - 未接入任何平台时，隐藏菜单、订单、查询、自动化工作区。
  - 新增断开平台动作：
    - 后端支持 `disconnect_platform`；
    - 若断开 UberEats，同步清理 OAuth 连接状态并回退接入流程状态。
  - 稳定性修复：
    - 修复外卖页在 `state` 为空阶段的空引用风险，避免首屏潜在白屏。
  - 管理台重设计（对标 Deliverect / Otter / StreamOrder）：
    - 接入成功后切为“左侧导航 + 主工作区”结构；
    - 订单中台改为三栏（状态筛选/订单列表/履约动作）；
    - 菜单中台改为高密度工具栏+表格，支持搜索/分类/平台筛选；
    - 保留订单查询、自动化策略、Webhook 事件流并作为独立工作台页签。

### 阶段 M：稳定性与移动端体验优化（2026-03-06）
- 目的：修复 Copilot 指令队列闪烁，并将外卖管理页移动端体验提升到“低学习成本可直接操作”的水平。
- 关键成果：
  - 修复 `经营 Copilot` 指令队列闪烁：
    - 根因：`useToast()` 每次渲染返回新对象，导致依赖它的 effect 重复触发数据加载；
    - 处理：`hooks/useToast.ts` 改为 `useMemo` 返回稳定实例，避免重复刷新队列。
  - 外卖管理移动端重排：
    - 工作台导航在移动端改为横向可滚动 tabs，减少左侧栏挤压；
    - 订单中台新增移动卡片流（顾客/状态/金额/ETA 同屏，点选后直接履约）；
    - 菜单中台新增移动卡片流（菜品信息 + 渠道价与上下架开关），保留桌面高密度表格；
    - 订单查询新增移动卡片流，桌面继续保留表格+详情双栏；
    - 新增“仅看已接入平台上架菜品”筛选开关，减少菜单管理噪音。

### 阶段 N：英文界面溢出修复（2026-03-06）
- 目的：修复 `Delivery Management` 英文模式下平台接入卡片文字重叠、越界和可读性下降问题。
- 关键成果：
  - 平台接入卡片网格改为响应式分级列数（`sm:2 / xl:4 / 2xl:5`），避免卡片过窄引发挤压。
  - 平台卡片操作按钮改为纵向堆叠，并启用自适应高度与换行，消除长英文文案溢出。
  - 英文授权按钮文案由 `Authorize connection` 收敛为 `Authorize`，减少排版压力。
  - 状态徽章加 `whitespace-nowrap`，避免 `Not connected` 在窄宽度下异常换行导致错位。

### 阶段 O：移动端布局专项修复（2026-03-06）
- 目的：修复手机端 Dashboard/Analysis 在小屏幕下的按钮挤压、文字竖排和内容出界问题。
- 关键成果：
  - `Analysis` 上传区头部改为移动端纵向布局，按钮由横向挤压改为竖向堆叠，解决“上传文档/仅用上传数据分析”竖排和越界。
  - `PageHeader` 操作区改为移动端 `w-full + wrap` 策略，避免标题和操作按钮互相挤占。
  - 顶部 `Navbar` 的“运行分析”按钮在小屏改为图标优先显示，缓解语言切换后的头部拥堵。
  - Dashboard 日报内容增加 `break-words`，避免英文长句导致横向溢出。

### 阶段 P：外卖管理可调用功能按钮集中化（2026-03-06）
- 目的：按最新要求把“可调用功能按钮”集中展示在外卖管理页，减少用户在多个子模块来回查找操作入口。
- 关键成果：
  - 新增 `Command Center（统一操作台）`：
    - 常驻展示工作区快捷入口（订单中台/菜单中台/订单查询/自动化/事件流）；
    - 常驻展示全局动作按钮（刷新、立即同步、发布菜单）；
    - 常驻展示履约动作面板（接单/开始制作/标记待取/完成/取消），直接对当前选中订单执行；
    - 常驻展示平台接单开关（按平台暂停/恢复接单）。
  - 保持原有 API 不变，仅在前端重组操作入口，避免破坏现有后端状态机。
  - 页面交互顺序更贴合 UberEats / DoorDash tablet 高频运营路径：先看队列与履约，再做菜单同步与策略调整。

### 阶段 F：上传数据提交流程与 Dashboard 同步（2026-02-27）
- 目的：让用户在上传运营数据后有明确的“提交并分析”动作，并让分析后的上传数据同步到 Dashboard 总览模块。
- 关键成果：
  - `Analysis` 上传区新增 `提交并分析` 按钮，点击后才正式触发 Agent A -> D 分析。
  - 分析结果与上传文档会写入浏览器本地运行时存储，作为“已接入的 POS / 外卖平台运营数据”使用。
  - `Dashboard` 现在优先读取这份运行时状态，展示：
    - 已接入运营文件数量
    - Agent A 已解析数量
    - POS / 外卖来源数量
    - 最近同步时间
  - 分析页点击 `清空` 时，会同时清空 Dashboard 中的同步结果，避免旧数据残留。

## 3. 当前系统状态（交接时刻）

- 官网与后台均可访问，基础业务流程可演示。
- Meta 授权可完成，但真实数据读取受 Meta 权限/账户绑定状态影响。
- 社媒接口已支持部分成功不全量回退（`live_partial`）。
- Instagram Webhook 已可在 Meta 页面通过验证。
- Google Business OAuth 骨架已完成，但需要 Google Cloud OAuth 凭据与 Business Profile API 权限后才能打通真实授权。
- Yelp 商家账号“统一管理/回复”未打通，原因不是代码未写，而是 Yelp 官方 Partner 权限限制；当前公开 `YELP_API_KEY` 只能做公开数据读取。
- Analysis 已支持手动上传运营数据，并能把上传结果送入 Agent A -> D 的分析链路。
- Uber Eats 已作为首个外卖平台接入设置层与分析层；若 live 拉取不可用，系统自动回落到上传文件方案，不阻断业务流程。
- 当前主站和 Python orchestrator 均已恢复到可构建状态，可继续推进 v3 多 Agent 架构接线与真实数据适配。
- Conversational Ops 模块已具备端到端主链路（解析 -> 预览 -> 审批/执行 -> 回滚 -> 审计），可作为“对话式经营执行”后续深挖基础。

## 4. 新研发上手清单（无缝接手）

1. 本地启动
```bash
npm install
cp .env.example .env.local
npm run dev
```

2. 线上部署
```bash
ssh -i '/Users/c8geek/Downloads/LightsailDefaultKey-us-west-2 (5).pem' ubuntu@34.220.87.202
cd ~/iqproject
npm run build
pm2 restart iqproject --update-env
```

3. Meta 关键配置（控制台）
- App Domains：`restaurantiq.ai`, `www.restaurantiq.ai`
- OAuth callback：`https://restaurantiq.ai/api/integrations/meta/callback`
- Instagram webhook callback：`https://restaurantiq.ai/api/webhooks/meta/instagram`
- Verify token：使用服务器 `META_INSTAGRAM_WEBHOOK_VERIFY_TOKEN`

4. 验证接口
- `/api/health`
- `/api/integrations/meta/status`
- `/api/integrations/google-business/status`
- `/api/social/meta`（看 `source` 与 `warning`）
- `/api/analysis/upload`（多文件上传解析）
- `/api/integrations/ubereats/status`
- `/api/ops/commands`（创建/读取经营指令）
- `/api/ops/commands/[commandId]`（确认/审批/执行/回滚）

## 5. 修改文件清单（含最后修改时间 + 修改目的）

| 文件 | 最后修改时间 | 修改目的 |
|---|---|---|
| `app/layout.tsx` | 2026-02-23 12:48:30 PST | 全局根布局：Clerk Provider、主题与全局容器整合 |
| `middleware.ts` | 2026-02-23 15:25:00 PST | 路由保护与未登录重定向策略 |
| `app/(marketing)/page.tsx` | 2026-02-23 18:55:19 PST | 官网首页主内容：Hero、亮点、语言切换、品牌与转化模块 |
| `app/(marketing)/pricing/page.tsx` | 2026-02-23 15:11:26 PST | 官网定价页：接入 Clerk PricingTable 并提供降级方案 |
| `app/sign-in/[[...sign-in]]/page.tsx` | 2026-02-23 12:49:18 PST | 登录页：跳转策略、样式适配与鉴权联动 |
| `app/sign-up/[[...sign-up]]/page.tsx` | 2026-02-23 12:49:30 PST | 注册页：跳转策略、样式适配与鉴权联动 |
| `app/(dashboard)/layout.tsx` | 2026-02-23 13:00:29 PST | 后台总布局：导航、侧栏、语言/会话容器 |
| `app/(dashboard)/dashboard/page.tsx` | 2026-02-23 12:44:39 PST | Dashboard 路由入口与页面挂载 |
| `app/(dashboard)/analysis/page.tsx` | 2026-02-23 12:44:39 PST | Analysis 路由入口与页面挂载 |
| `app/(dashboard)/settings/page.tsx` | 2026-02-23 12:44:39 PST | Settings 路由入口与页面挂载 |
| `app/(dashboard)/account/page.tsx` | 2026-02-23 12:49:03 PST | Account 路由入口与页面挂载 |
| `app/(dashboard)/billing-access/page.tsx` | 2026-02-23 15:24:49 PST | 套餐/功能权限演示页面（Plan/Feature gating） |
| `app/(dashboard)/social-radar/page.tsx` | 2026-02-23 13:25:30 PST | 社媒雷达路由入口 |
| `components/layout/Navbar.tsx` | 2026-02-23 17:33:17 PST | 顶部导航：品牌 Logo、语言切换、用户入口 |
| `components/layout/Sidebar.tsx` | 2026-02-23 17:33:34 PST | 后台侧边导航：模块入口与品牌区 |
| `components/layout/DashboardShell.tsx` | 2026-02-23 12:45:27 PST | 后台页面壳层：统一间距与结构 |
| `components/layout/PageHeader.tsx` | 2026-02-23 12:40:03 PST | 页面头部通用组件（标题/副标题/操作区） |
| `components/dashboard/DashboardClient.tsx` | 2026-02-23 13:02:03 PST | Dashboard 业务交互与数据展示 |
| `components/dashboard/RecommendationCard.tsx` | 2026-02-23 13:13:47 PST | 建议卡片：详情展开、执行预览、状态呈现 |
| `components/dashboard/ExecutionLogPanel.tsx` | 2026-02-23 13:02:53 PST | 执行日志面板 |
| `components/analysis/AnalysisClient.tsx` | 2026-02-23 13:43:56 PST | 分析中心：运行分析、排序、执行与回滚交互 |
| `lib/client/analysis-runtime.ts` | 2026-02-27 22:05:00 PST | 浏览器本地运行时存储：保存上传文档与分析结果，并同步给 Dashboard 使用 |
| `components/settings/SettingsClient.tsx` | 2026-02-25 13:27:24 PST | 设置中心主逻辑：保存/恢复、集成状态、表单交互 |
| `components/settings/IntegrationStatusPanel.tsx` | 2026-02-25 13:24:26 PST | 集成状态面板：连接按钮、测试连接、状态展示 |
| `components/account/AccountClient.tsx` | 2026-02-23 13:43:09 PST | 账户中心：订阅、团队、权限与安全提示 |
| `components/account/AccountMockClient.tsx` | 2026-02-23 13:43:27 PST | 未登录或 mock 场景的账户页降级展示 |
| `components/social/SocialRadarClient.tsx` | 2026-02-25 15:46:26 PST | 社媒雷达主交互：指标、评论回复、提及列表、Meta 状态 |
| `components/SwipeToConfirm.tsx` | 2026-02-23 13:07:58 PST | 滑动确认组件：阈值判定、回弹、触发保护 |
| `app/api/health/route.ts` | 2026-02-23 12:44:39 PST | 健康检查接口：前后端与集成状态探测 |
| `app/api/analysis/route.ts` | 2026-02-23 12:44:39 PST | 分析引擎接口（mock/live 回退） |
| `app/api/execute/route.ts` | 2026-02-23 12:44:39 PST | 执行接口：任务状态流与回滚时间返回 |
| `app/api/integrations/weather/route.ts` | 2026-02-23 13:06:30 PST | 天气/宏观因子接口（Google/Open-Meteo + mock） |
| `app/api/integrations/yelp/route.ts` | 2026-02-23 13:05:45 PST | Yelp 数据接口（live + fallback） |
| `app/api/integrations/maps/route.ts` | 2026-02-23 13:06:09 PST | 地图/商圈接口（Google Places + fallback） |
| `app/api/integrations/nextdoor/callback/route.ts` | 2026-02-25 12:29:58 PST | Nextdoor OAuth 回调占位 |
| `app/api/integrations/meta/start/route.ts` | 2026-02-26 01:18:47 PST | Meta OAuth 发起：provider + scopes + state |
| `app/api/integrations/meta/callback/route.ts` | 2026-02-25 15:43:59 PST | Meta OAuth 回调：code 换 token、连接状态写入 |
| `app/api/integrations/meta/status/route.ts` | 2026-02-25 13:25:16 PST | Meta 连接状态查询接口 |
| `app/api/social/ai-reply/route.ts` | 2026-02-23 13:25:49 PST | 社媒评论 AI 回复草稿接口 |
| `app/api/social/reply/route.ts` | 2026-02-23 13:25:49 PST | 社媒回复发送/回撤接口 |
| `app/api/social/meta/route.ts` | 2026-02-26 17:56:35 PST | 社媒雷达 Meta 数据聚合接口（live/live_partial/mock） |
| `app/api/integrations/google-business/start/route.ts` | 2026-02-27 16:41:00 PST | Google Business OAuth 发起接口 |
| `app/api/integrations/google-business/callback/route.ts` | 2026-02-27 16:41:00 PST | Google Business OAuth 回调，换 token 并读取账号/门店 |
| `app/api/integrations/google-business/status/route.ts` | 2026-02-27 16:41:00 PST | Google Business 连接状态查询 |
| `app/api/analysis/upload/route.ts` | 2026-02-27 16:47:00 PST | 运营数据上传解析接口，供 Agent A 预处理文件 |
| `app/api/marketing/demo-request/route.ts` | 2026-02-22 21:26:47 PST | 官网 Demo 预约接口 |
| `app/api/webhooks/meta/instagram/route.ts` | 2026-02-26 01:27:37 PST | Instagram Webhook 验证与接收占位接口 |
| `lib/env.ts` | 2026-02-25 13:14:00 PST | 环境变量解析与配置状态统一出口 |
| `lib/types.ts` | 2026-02-27 16:44:00 PST | 扩展上传文档类型、Google Business / Yelp Partner 集成状态类型、Agent D 信号 |
| `lib/mock-data.ts` | 2026-02-27 16:42:00 PST | 补充 Google Business / Yelp Partner 的设置页 mock 状态 |
| `lib/api/client.ts` | 2026-02-23 12:38:32 PST | 前端 API 客户端封装 |
| `lib/api/analysis.ts` | 2026-02-27 16:49:00 PST | 分析域 API 封装，新增多文件上传接口 |
| `lib/api/execute.ts` | 2026-02-23 12:38:32 PST | 执行域 API 封装 |
| `lib/api/integrations.ts` | 2026-02-23 12:38:32 PST | 集成域 API 封装 |
| `lib/server/meta-oauth-store.ts` | 2026-02-25 15:43:32 PST | 服务端 Meta OAuth 临时存储（用户 token/page 映射） |
| `app/(dashboard)/ops-copilot/page.tsx` | 2026-03-06 02:50:56 PST | 对话式经营执行页面入口 |
| `components/ops/ConversationalOpsClient.tsx` | 2026-03-06 02:50:56 PST | 对话式执行 UI：输入、预览、状态机、动作按钮、审计与结果 |
| `app/api/ops/commands/route.ts` | 2026-03-06 02:50:56 PST | 指令创建与列表查询 API |
| `app/api/ops/commands/[commandId]/route.ts` | 2026-03-06 02:50:56 PST | 指令动作 API（确认/审批/定时/执行/回滚/驳回） |
| `lib/ops-copilot-types.ts` | 2026-03-06 02:50:56 PST | 对话式经营执行类型系统与状态定义 |
| `lib/server/ops-copilot-engine.ts` | 2026-03-06 02:50:56 PST | 指令解析、预览构建、状态流转、执行模拟与回滚逻辑 |
| `lib/server/ops-copilot-store.ts` | 2026-03-06 02:50:56 PST | Ops 指令状态持久化（runtime） |
| `lib/server/llm/provider-json.ts` | 2026-03-06 02:50:56 PST | OpenAI/Claude 结构化输出路由与降级控制 |
| `components/layout/Navbar.tsx` | 2026-03-06 02:50:56 PST | 新增 `ops-copilot` 顶部导航入口 |
| `components/layout/Sidebar.tsx` | 2026-03-06 02:50:56 PST | 新增 `ops-copilot` 侧栏入口 |
| `lib/dashboard-language.ts` | 2026-03-06 02:50:56 PST | 增加中英文 `经营 Copilot` 文案 |
| `middleware.ts` | 2026-03-06 02:50:56 PST | 保护 `/ops-copilot` 路由 |
| `lib/server/google-business-oauth-store.ts` | 2026-02-27 16:40:00 PST | 服务端 Google Business OAuth 临时存储（token/account/location 映射） |
| `lib/server/ops-document-parser.ts` | 2026-02-27 16:45:00 PST | Agent A 文件清洗/归类预处理器 |
| `lib/server/analysis-agent-runtime.ts` | 2026-02-27 16:47:00 PST | 四 Agent 协作分析运行时（A/B/C 数据 -> D 综合分析） |
| `hooks/useToast.ts` | 2026-02-23 12:38:32 PST | 全局提示 Hook |
| `hooks/useExecution.ts` | 2026-02-23 12:38:32 PST | 执行状态管理 Hook |
| `hooks/useRecommendations.ts` | 2026-02-23 12:38:32 PST | 建议列表状态管理 Hook |
| `hooks/useIntegrationStatus.ts` | 2026-02-23 12:38:32 PST | 集成状态读取 Hook |
| `.env.example` | 2026-02-27 16:41:00 PST | 环境变量模板（新增 Google Business / Yelp Partner 占位） |
| `eslint.config.mjs` | 2026-02-27 16:56:00 PST | 排除 `.next_build_backup_*`，避免构建产物污染 lint 结果 |
| `public/branding/logo-mark.png` | 2026-02-23 17:00:05 PST | 品牌图标资源 |
| `public/branding/logo-wordmark.png` | 2026-02-23 18:54:56 PST | 品牌文字 Logo 资源（透明背景） |
| `public/restaurant-iq-logo-mark.svg` | 2026-02-23 16:25:53 PST | 品牌图标 SVG 资源 |
| `public/marketing/workflow/step-1-operations-overview.png` | 2026-02-23 16:09:06 PST | 官网亮点模块配图素材 |
| `public/marketing/workflow/step-2-ai-recommendations.png` | 2026-02-23 16:09:06 PST | 官网亮点模块配图素材 |
| `public/marketing/workflow/step-3-swipe-confirm-execution.png` | 2026-02-23 16:09:06 PST | 官网亮点模块配图素材 |
| `public/marketing/workflow/step-4-fast-rollback.png` | 2026-02-23 16:09:06 PST | 官网亮点模块配图素材 |
| `public/marketing/workflow/step-5-social-monitoring.png` | 2026-02-23 16:09:06 PST | 官网亮点模块配图素材 |
| `public/marketing/workflow/step-6-social-reply.png` | 2026-02-23 16:09:06 PST | 官网亮点模块配图素材 |

## 6. 已知待办（建议下一位研发优先处理）

1. Meta 权限精细化：将 Facebook/Instagram 的读取、评论回复、发布权限按用例拆分并完成审核。
2. Google Business 真实授权：补齐 Google Cloud OAuth 配置、刷新 token 可靠持久化、真实 reviews/replies 写回。
3. Yelp Partner 接入：若拿到 Partner 审批，补 Owner OAuth、统一回复与商家级数据托管接口。
4. Social Radar 真实化：补齐 Instagram comments/feed 全量映射，减少 mock 占比。
5. Webhook 生产处理：为 `/api/webhooks/meta/instagram` 增加签名校验、幂等处理、事件入库。
6. Token 持久化：将 Meta/Google token 从服务端内存存储迁移到数据库（加密存储 + 轮换机制）。
7. Agent A 解析增强：补 PDF/XLSX/图片 OCR/Zip 等 parser，避免“仅元数据索引”长期存在。
8. Agent 输出可视化：在 Analysis 增加 A/B/C/D 各 Agent 的结构化输出面板，便于调试与解释性展示。
9. 继续把 `COMPLETE_FIX_ALL_AGENTS_v3.md` 中剩余“真正切换到新 A/B/C/D 语义展示、Dashboard 消费 frontendReady、AgentTune 与 Python orchestrator 反向读 current pipeline”三项做完，而不是停留在可构建状态。

## 7. 后续架构设计文档

- 多 Agent orchestration 后端设计：
  - `docs/MULTI_AGENT_ORCHESTRATION_DESIGN_ZH.md`

该文档用于指导当前分析引擎从“单函数分析”升级为“有 planner / supervisor / policy gate / execution planner 的可编排多 Agent 框架”。

### 当前已落地的第一版骨架（2026-02-28 PST）

以下骨架已经在代码里落地，并通过 `npm run build`：

1. 新 orchestration 主入口：
   - `lib/server/orchestration/analysis-orchestrator.ts`
2. 规划层：
   - `lib/server/orchestration/planner.ts`
   - `lib/server/orchestration/supervisor.ts`
   - `lib/server/orchestration/policy-gate.ts`
   - `lib/server/orchestration/execution-planner.ts`
3. 业务 Agent 分层：
   - `lib/server/agents/agent-a-ops.ts`
   - `lib/server/agents/agent-b-social.ts`
   - `lib/server/agents/agent-c-macro.ts`
   - `lib/server/agents/agent-d-synthesis.ts`
4. 分析 API 已切到新的 orchestrator：
   - `app/api/analysis/route.ts`
5. 旧入口保留兼容 shim，避免其他模块引用断裂：
   - `lib/server/analysis-agent-runtime.ts`
6. Analysis 页面已增加 Agent A / B / C / D 结构化输出面板：
   - `components/analysis/AgentOrchestrationPanel.tsx`
   - `components/analysis/AnalysisClient.tsx`
7. Agent B / C 已接入真实优先 server adapters：
   - `lib/server/adapters/social-radar.ts`
   - `lib/server/adapters/macro-signals.ts`
   - `app/api/social/meta/route.ts`
   - `app/api/integrations/weather/route.ts`

### 这一版骨架的目的

1. 先把“单文件、单函数、串行推导”的分析逻辑拆成明确的 orchestration 层和 agent 层。
2. 保持前端接口不变，让 `/analysis`、`/dashboard`、上传数据流程不需要重写即可继续工作。
3. 为下一阶段继续接真实 social / macro / POS / Google Business / Yelp Partner 数据时，提供稳定的扩展点。
4. 为后续加入：
   - agent 输出可视化
   - 运行状态机
   - 失败重试
   - evidence trace
   - policy gating
   - execution planning
   做结构准备。

### 当前前端可见能力补充（2026-02-28 PST）

Analysis 页面现在除了建议列表外，还会展示：

1. Agent A / B / C / D 的摘要说明
2. 每个 Agent 的运行状态与置信度
3. 每个 Agent 的结构化 payload 预览
4. 每个 Agent 的 evidence 数量与 warning

这样做的目的：

1. 让商家和研发都能看到“为什么会得出这些建议”。
2. 为后续 prompt 调试、parser 调试、真实 API 接入调试提供直接的观察窗口。
3. 把 orchestration 从“只在后端存在”变成“前端可解释、可验证”的系统能力。

### 当前限制

1. Agent B / C 已经切到“真实优先 + 失败回退”的 adapter，但真实数据覆盖仍不完整（例如本地事件、新闻、政府数据、USDA 食材价格等尚未接入）。
2. Planner / Supervisor / Policy Gate 已有代码骨架，但还不是完整任务编排器（尚未引入队列、重试、持久化 run state）。
3. 执行规划当前是 preview 级别，还没有和真实外部执行 adapter 做双向联动。

新研发开始接下一阶段后端时，优先阅读这份设计文档，然后从上述骨架继续推进，而不是把逻辑重新塞回单一 runtime 文件。

### Agent B / C 当前补充状态（2026-02-28 PST）

1. Agent B 现在会优先读取统一的 social radar server adapter：
   - Facebook Page posts / comments
   - Instagram media
   - Google Business reviews
   - 若真实读取失败，再回退 mock

2. Agent C 现在会优先读取统一的 macro server adapter：
   - Google Geocode
   - Open-Meteo
   - Google Places
   - 若真实读取失败，再回退 fallback / mock

3. `/api/social/meta` 和 Agent B 已复用同一套 server adapter，目的是避免“前端雷达看到一套数据、分析引擎看到另一套数据”的漂移问题。

4. `/api/integrations/weather` 和 Agent C 已复用同一套 macro adapter，后续继续叠加 holiday、local events、traffic disruption、government / CPI / USDA 等数据时，只需要扩展 adapter，不需要同时改前端路由和分析引擎。

### Agent Management Dashboard（内部使用，2026-02-28 PST）

1. 新增内部 Agent 管理台页面：
   - `app/(dashboard)/agent-management/page.tsx`
   - `components/agent-management/AgentManagementClient.tsx`

2. 当前能力：
   - 以 box 形式展示 Agent A / B / C / D / Execution Planner
   - 拖拽节点位置
   - 节点间拖拉连线
   - 编辑每个 Agent 的：
     - 使用模型
     - prompt
     - temperature
     - top_p
     - fine-tune / variant
     - enabled 状态
   - 新增 Agent
   - 删除 Agent

3. 当前访问方式：
   - 该页面设计为 **仅内部使用**
   - 目标访问域名：
     - `https://agenttune.restaurantiq.ai`
   - 访问策略已写入中间件：
     - 非 `agenttune.restaurantiq.ai` 访问 `/agent-management` 会被重定向走
     - `agenttune.restaurantiq.ai` 访问 `/` 或 `/dashboard` 会自动跳转到 `/agent-management`
   - 相关代码：
     - `middleware.ts`
     - `lib/agent-studio-host.ts`

4. 当前存储方式：
   - 在 `agenttune` 子域访问时，优先走服务端共享存储：
     - `app/api/agent-management/graph/route.ts`
     - `lib/server/agent-graph-store.ts`
   - graph 会写入服务器运行目录：
     - `.runtime/agent-studio/graph.json`
   - 目的：让内部团队共享同一套 orchestration graph，而不是只存在单个浏览器 localStorage 中。
   - 若不在 `agenttune` 子域，则会自动回退到浏览器本地草稿存储。

5. 当前限制：
   - 这版已经实现“配置管理台”，但还没有把每个 Agent box 中的 prompt / model 参数完整注入到所有运行时 Agent 中。
   - 现阶段它已经是可用的 orchestration 管理 UI 和共享 graph 存储层；
   - 下一阶段要继续做的是：
     - 将 graph 配置映射到 planner / agent runner / synthesis runtime
     - 基于连线顺序真正驱动执行 DAG
     - 把 enabled / model / prompt 参数注入到具体 Agent 执行逻辑

### Python Orchestrator 双写同步（2026-03-01 PST）

1. 当前 `agenttune.restaurantiq.ai` 的保存链路已升级成：
   - 先保存 Next.js 本地 graph
   - 再同步一份到 Python orchestrator 的 `PipelineConfig`

2. 相关实现：
   - `app/api/agent-management/graph/route.ts`
   - `lib/server/python-orchestrator-sync.ts`

3. 这次映射逻辑的目的：
   - 把现有 AgentTune 画布里的节点配置转换成 Python 侧可消费的 `PipelineConfig`
   - 不要求前端立刻重做，也不要求现有 graph 结构立刻和 Python 1:1 完全一致
   - 先打通“配置能同步过去”这条链路

4. Python orchestrator 新增的支持项：
   - 新增 `execution_planner` 通用执行节点
   - 新增 `custom_generic` 自定义节点
   - 新增 `INTERNAL_API_KEY` 最小内部鉴权

5. 当前行为说明：
   - 如果未配置 `PYTHON_ORCHESTRATOR_API_URL`，AgentTune 保存仍然成功，只是跳过 Python 同步
   - 如果本地 graph 保存成功，但 Python 同步失败：
     - 当前请求会返回明确错误原因
     - 本地 graph 已落盘
     - 前端会自动退回本地草稿模式

6. 当前仍未完成：
   - AgentTune 画布还没有直接读取 Python orchestrator 当前 pipeline 作为唯一数据源
   - Python orchestrator 还没有真正驱动生产 Analysis 流程
   - 还没有 WebSocket 级别的运行状态从 Python 服务反推回 AgentTune UI

### OpenAI 统一 LLM 路线（2026-03-01 PST）

1. 当前主站分析运行时已统一到 OpenAI：
   - `lib/server/agents/agent-a-ops.ts`
   - `lib/server/agents/agent-d-synthesis.ts`
   - `lib/server/openai-json.ts`

2. 目的：
   - Agent A 在上传运营文件后，不再只是做 deterministic 归类，而是会调用 OpenAI 对已清洗的数据做二次运营分析，输出：
     - `executiveSummary`
     - `detectedPatterns`
     - `qualityAssessment`
     - `priorityFocusAreas`
   - Agent D 保持使用 OpenAI 进行融合分析与建议生成。

3. Python orchestrator 也已切到 OpenAI 路线：
   - `restaurantiq-agents/app/llm/openai_json.py`
   - `restaurantiq-agents/app/orchestrator/supervisor.py`
   - `restaurantiq-agents/app/agents/analyzer.py`
   - `restaurantiq-agents/app/config.py`
   - `restaurantiq-agents/app/models/agent_config.py`

4. 现在的行为：
   - 若配置了 `OPENAI_API_KEY`，Python Supervisor 会优先使用 OpenAI 规划激活 Agent 集合；
   - Python Analyzer 会优先使用 OpenAI 生成融合分析摘要与建议；
   - 若未配置，则两者自动回退到 deterministic 逻辑，避免服务不可用。

5. 这次改动的目的：
   - 让“上传数据 -> Agent A -> 分析 -> 建议”与新 Python orchestration 路线都统一到 OpenAI，减少后续维护两套 LLM 供应商配置的复杂度。

### Dashboard 改为分析结果驱动（2026-03-01 PST）

1. 总览模块的数据来源已从“上传文件数量 / 同步时间”这类占位指标，切换为直接读取最近一次分析结果中的真实结构化输出：
   - Agent A：`aggregatedMetrics`、`normalizedDatasets`、`llmAnalysis`
   - Agent B：评论/提及数量、活跃平台、社媒摘要
   - Agent C：天气预警、降水概率、宏观因子摘要
   - Agent D：当前最高优先级建议与执行确认要求

2. 相关实现：
   - `lib/client/analysis-runtime.ts`
   - `components/dashboard/DashboardClient.tsx`
   - `components/dashboard/OperationalSnapshot.tsx`
   - `lib/dashboard-language.ts`

3. 当前总览页现在展示的核心信息：
   - 解析后营收
   - 人工成本与营收占比
   - 社媒与评论信号
   - 当前优先动作数量与人工确认需求
   - 经营分析快照（经营焦点、社媒与外部环境摘要、当前优先建议）

4. 补充优化（2026-03-01 PST 晚些）：
   - 去掉总览卡片中“已接入运营文件数量 / 已清洗比例”这类偏内部诊断信息
   - 改为展示纯业务结果导向指标：
     - 解析后营收
     - 订单量
     - 人工成本与营收占比
     - 社媒/评论信号
     - 当前优先建议
   - 目的：
     - 让 Dashboard 面向商家时更像经营总览，而不是数据处理状态页

5. 这次改动的目的：
   - 让 Dashboard 真正成为“分析结果总览”，而不是上传状态面板
   - 让用户一打开总览就能看到 Agent 解析后的经营指标、风险和建议
   - 为后续把更多真实接入（Google Business / Yelp Partner / POS）映射到总览提供稳定承载层

6. 当前边界：
   - 如果还没有跑过一次分析，Dashboard 仍会回退到默认样例
   - 要看到真实经营数据，必须先在 `Analysis` 页面提交一次上传分析流程

### Agent A 增加 Excel 解析能力（2026-03-01 PST）

1. `Agent A` 的上传解析器已新增对 Excel 文件的真实解析支持：
   - 支持格式：`.xlsx` / `.xls` / `.xlsm` / `.xlsb`
   - 不再对这些文件统一走 `binary_file_metadata_only`

2. 相关实现：
   - `lib/server/ops-document-parser.ts`
   - `lib/types.ts`
   - `package.json`

3. 当前行为：
   - 读取 workbook 的多个 worksheet
   - 规范化表头
   - 清理空白行
   - 聚合各 sheet 的数值指标
   - 推断日期范围、时间粒度、数据集提示和 canonical metrics
   - 将结果直接提供给 Agent A / Agent D 分析链路使用

4. 这次改动的目的：
   - 让用户上传的月度销售汇总、账单明细、菜品汇总等 Excel 文件能真正被解析和结构化
   - 消除之前界面中出现的 `Binary parser adapter not implemented yet`
   - 为后续接 `xlsx -> Dashboard 总览指标` 和 `Agent A LLM 分析` 提供真实输入

5. 当前边界：
   - `pdf / image / zip / OCR` 仍未深度解析
   - 若 `OPENAI_API_KEY` 无效，Agent A 的 LLM 补充分析仍会 fallback，但 Excel 结构化解析本身已可用

### 文档驱动的 v3 DAG 升级（2026-03-01 PST）

本轮升级严格参考以下研发文档执行：

- `/Users/c8geek/Downloads/files 2/agent_c_optimized_v2.md`
- `/Users/c8geek/Downloads/files 2/agent_d_optimized_v2.md`
- `/Users/c8geek/Downloads/files 2/dev_task_cards.md`
- `/Users/c8geek/Downloads/files 2/langflow_update_guide.md`
- `/Users/c8geek/Downloads/files 2/restaurantiq_deployment_guide.md`

1. 升级前备份：
   - Git 标签：`backup/20260301-130324-before-doc-upgrade`
   - 压缩备份：`/Users/c8geek/Desktop/dineradar/boaura/_project_backups/iqproject-20260301-130410.tar.gz`

2. AgentTune graph 模型升级：
   - 支持 `planner` / `validator` 节点类型
   - 每个节点支持 richer 参数：
     - `model / temperature / topP / maxTokens`
     - `prompt / promptTemplate / fewShotExamples`
     - `tools / maxToolCalls`
     - `retryCount / timeoutSeconds / batchSize`
     - `scheduleCron / triggerEvents`
   - 保存和读取统一走 normalize

3. AgentTune → Python orchestrator 双写同步升级：
   - graph 保存后会把 richer 配置同步为 Python `PipelineConfig`
   - 现已支持同步 `planner_strategy` / `validator_output`
   - 相关代码：
     - `lib/server/python-orchestrator-sync.ts`
     - `app/api/agent-management/graph/route.ts`

4. Python 默认 DAG 升级：
   - 从：
     - `A/B/C -> Fusion -> Executors`
   - 升级为：
     - `A/B/C -> Fusion -> Planner -> Validator -> Executors`
   - 并增加：
     - `fusion -> validator`

5. 新增 Planner Agent（对应文档中的策略规划层）：
   - 文件：
     - `restaurantiq-agents/app/agents/planner_strategy.py`
   - 当前输出：
     - `plan.north_star`
     - `plan.task_board.tasks`
     - `plan.experiments`
     - `plan.data_requests`
     - `plan.assumptions`
     - `plan.release_notes`
   - 当前 deterministic 版本已满足：
     - 8 个任务
     - 3 个实验
     - 5 个 data requests
     - 5 条 assumptions
     - 中英双语 release notes

6. 新增 Validator Agent（对应文档中的 QA/Frontend Formatter 层）：
   - 文件：
     - `restaurantiq-agents/app/agents/validator_output.py`
   - 当前输出：
     - `validated_plan`
     - `qa_report`
     - `frontend_ready`
   - `frontend_ready` 已包含：
     - `health_badge`
     - `kpi_cards`
     - `top_actions`
     - `timeline`
     - `quick_stats`

7. 执行器接入 Validator：
   - 执行器不再只读 Fusion 的 `recommendations`
   - 现在优先读取：
     - `validated_plan.task_board.tasks`
     - `frontend_ready.top_actions`
     - `qa_report.status`
   - 目的：
     - 让 execution preview 真正基于“校验后的执行计划”

8. 本轮验证结果：
   - Python 语法编译：
     - `python3 -m compileall restaurantiq-agents/app restaurantiq-agents/tests`
     - 结果：通过
   - Next.js 构建：
     - `npm run build`
     - 结果：通过

9. 当前边界：
   - 本机缺少完整 Python 运行依赖环境，因此本轮完成了语法级验证和 Next 构建验证
   - 下一步在服务器上继续做 Python orchestrator 的真实运行验证与 shadow run

## 2026-03-02 后台界面中文化补漏

### 修改目的

- 解决“后台语言切到中文后，界面仍残留英文”的问题。
- 本次问题不是语言状态失效，而是部分页面和组件仍然写死英文文案，未接入统一语言字典。
- 优先修复用户最容易看到、最影响观感的区域：总览页标题、账户角色、内部 Agent Studio、Billing Access、Agent 运行状态。

### 本次修改范围

1. 统一补全后台语言字典：
   - 文件：`lib/dashboard-language.ts`
   - 新增/修正：
     - `总览` 标题中文文案
     - 账户角色中文映射
     - `Demo User` 中文文案
     - `Internal Agent Studio` 中文文案
     - `Billing Access` 整页中英文文案

2. 修复账户页中角色仍显示英文的问题：
   - 文件：
     - `components/account/TeamMembersPanel.tsx`
     - `components/account/OrgProfileCard.tsx`
     - `components/account/AccountClient.tsx`
     - `components/account/AccountMockClient.tsx`
   - 结果：
     - `Owner / Manager / Staff` 会随后台语言切换显示为中文
     - mock 用户名与邀请反馈也会随语言切换

3. 修复内部 Agent 管理后台的英文残留：
   - 文件：
     - `components/layout/Navbar.tsx`
     - `components/layout/Sidebar.tsx`
     - `components/agent-management/AgentManagementClient.tsx`
     - `app/(dashboard)/agent-management/page.tsx`
   - 结果：
     - 内部工作室标识、页面标题、未授权提示不再固定为英文

4. 重做 Billing Access 页面语言切换方式：
   - 文件：
     - `components/dashboard/BillingAccessClient.tsx`
     - `app/(dashboard)/billing-access/page.tsx`
   - 原因：
     - 旧版页面是 server-only 硬编码英文页面，无法跟随前端语言切换。
   - 结果：
     - 现在页面会跟随后台语言切换实时显示中文/英文。

5. 修复分析页 Agent 状态标签英文残留：
   - 文件：
     - `components/analysis/AgentOrchestrationPanel.tsx`
   - 结果：
     - `idle / running / success / error` 等运行状态在中文模式下会显示中文标签。

### 验证结果

- 执行：
  - `npm run build`
- 结果：
  - 构建通过

### 结论

- 后台语言切换功能本身是正常的。
- 问题根因是“部分页面未接入统一语言字典”而不是“状态没切过去”。
- 本轮已优先修复用户最直接可见的英文残留区域。

## 2026-03-02 16:35 PST - Dashboard 按真实经营数据重构

### 修改目的

- 修复 Dashboard 总览卡和推荐动作展开区“像调试面板而不像经营看板”的问题。
- 严格按用户提供的《RestaurantIQ Dashboard 设计规范 v2.0》重构：
  - KPI 必须来自真实上传销售数据，而不是内部解析状态。
  - 推荐详情必须面向经营者解释“为什么推荐、执行后有什么效果、怎么做、怎么止损”，不能再暴露原始 JSON。

### 数据口径修复

本轮针对 `销售汇总表` Excel 做了口径修正，确保 Agent A 解析结果与用户提供的真实业务口径一致。

- 文件：
  - `lib/server/ops-document-parser.ts`
  - `lib/server/agents/agent-a-parser.ts`
- 修复点：
  - 正确识别 `总计` 行
  - 对 `账单数 / 实收金额 / 营业额 / 优惠金额 / 总退款金额` 应用当前业务表格口径
  - 生成 `overview`
  - 生成 `monthly_trend`
  - 生成 `platform_breakdown`
- 验证结果（使用用户提供的 2025-06 ~ 2025-11 样本 Excel）：
  - 总订单：`4248`
  - 总营收：`$197,875.54`
  - 平均客单价：`$46.58`
  - 日均订单：`30.6`
  - 总优惠：`$16,981.22`
  - 总退款：`$3,632.96`

### Dashboard 总览重构

- 文件：
  - `lib/client/analysis-runtime.ts`
  - `components/dashboard/AgentMetricCard.tsx`
  - `components/dashboard/OperationalSnapshot.tsx`
  - `lib/mock-data.ts`
- 重构结果：
  - 顶部 4 张 KPI 卡改为真实业务指标：
    - 总营收 / Total Revenue
    - 平均客单价 / Avg Order Value
    - 日均订单 / Daily Orders
    - 折扣率 / Discount Rate
  - 新增运营健康度分数
  - 新增月度趋势可视化
  - 新增平台订单分布
  - 总览不再显示“已接入运营文件数量”这类内部调试指标

### 推荐动作详情重构

- 文件：
  - `components/dashboard/RecommendationDetailSections.tsx`
  - `components/dashboard/RecommendationCard.tsx`
  - `components/analysis/ExecutionPreviewModal.tsx`
  - `lib/server/orchestration/analysis-orchestrator.ts`
  - `lib/types.ts`
  - `lib/dashboard-language.ts`
- 重构结果：
  - 展开详情不再显示 `execution_params` 原始 JSON
  - 改为用户可理解的四块内容：
    - 为什么推荐
    - 执行效果
    - 执行步骤
    - 风险控制 / 回滚方案
  - Agent D 输出结构同步扩展，支持 `why / impact / steps / stop_loss / rollback`

### 默认样例补齐

- 文件：
  - `lib/mock-data.ts`
- 目的：
  - 即使用户未重新运行分析，Dashboard 默认样例也应符合新规范，不出现空白趋势图或空壳推荐详情。
- 补齐内容：
  - `agentAParsed.overview`
  - `agentAParsed.monthly_trend`
  - `agentAParsed.platform_breakdown`
  - `agentAParsed.order_type_breakdown`

### 验证结果

- 执行：
  - `npm run build`
- 结果：
  - 构建通过

### 结论

- 本轮 Dashboard 已从“内部调试视角”切换到“经营分析视角”。
- 当前总览与推荐详情的展示，已对齐用户提供的真实业务数据口径和设计规范。

## 2026-03-01 服务器化分析结果持久化修复

### 背景

用户在完成上传与分析后，进入 Dashboard 仍看到“模拟数据”标记。根因不是 Dashboard 计算错误，而是此前 Dashboard 只读取浏览器本地 `localStorage` 中的分析运行态；一旦用户更换浏览器、打开无痕窗口、清缓存，或之前分析未成功写入本地状态，就会直接回退到 mock 数据。

### 本轮目标

- 将最近一次成功分析结果改为服务端持久化
- Dashboard 优先读取服务端最近一次分析结果
- Analysis 页面刷新后也能恢复最近一次真实分析结果
- 清空分析状态时，同时删除服务端持久化结果

### 修改文件

- `lib/analysis-runtime-state.ts`
- `lib/server/analysis-runtime-store.ts`
- `app/api/analysis/runtime/route.ts`
- `app/api/analysis/route.ts`
- `lib/client/analysis-runtime.ts`
- `components/analysis/AnalysisClient.tsx`
- `components/dashboard/DashboardClient.tsx`

### 修改目的

#### 1. 增加统一的分析运行态模型

- 文件：`lib/analysis-runtime-state.ts`
- 目的：
  - 把 `analysis + uploadedDocuments + updatedAt` 提取成共享类型
  - 避免前端和服务端分别维护两套不一致的运行态结构

#### 2. 增加服务端持久化存储

- 文件：`lib/server/analysis-runtime-store.ts`
- 目的：
  - 按用户维度，将最近一次成功分析结果持久化到 `.runtime/analysis/*.json`
  - 让 Dashboard/Analysis 不再依赖单个浏览器的本地状态

#### 3. 新增分析运行态 API

- 文件：`app/api/analysis/runtime/route.ts`
- 目的：
  - 提供当前登录用户最近一次分析结果的读取接口 `GET`
  - 提供清空接口 `DELETE`
  - 后续 Dashboard 与 Analysis 统一通过服务端接口恢复状态

#### 4. 分析成功后自动写入服务端运行态

- 文件：`app/api/analysis/route.ts`
- 目的：
  - 当分析请求成功返回后，服务端把当前结果和上传文件摘要一并写入持久化存储
  - 避免只在前端写 localStorage 导致状态不可靠

#### 5. 前端运行态工具新增服务端读写能力

- 文件：`lib/client/analysis-runtime.ts`
- 目的：
  - 保留 localStorage 作为兜底缓存
  - 增加读取/删除服务端运行态的客户端方法
  - 形成“服务端优先，本地兜底”的双层策略

#### 6. Analysis 页面改为服务端优先恢复

- 文件：`components/analysis/AnalysisClient.tsx`
- 目的：
  - 页面初始化时优先读取服务端最近一次分析结果
  - 若服务端无结果，再回退本地缓存
  - 点击清空时同时清除本地和服务端运行态

#### 7. Dashboard 改为服务端优先加载

- 文件：`components/dashboard/DashboardClient.tsx`
- 目的：
  - Dashboard 不再只从 `localStorage` 取数据
  - 优先获取服务端最近一次真实分析结果
  - 只有在服务端没有任何分析结果时，才回退到默认 mock

### 验证结果

- 执行：
  - `npm run build`
- 结果：
  - 构建通过

### 本轮结论

- “为什么明明分析过，Dashboard 仍显示模拟数据”这个问题，本质上已经从架构上修复
- 现在 Dashboard 和 Analysis 对最近一次分析结果的恢复不再依赖当前浏览器会话
- 后续如果还要继续提升稳定性，下一步应将 `.runtime/analysis/*.json` 进一步迁移到数据库或统一服务端状态存储

---

## 阶段 J：UberEats client_assertion + 实时 Webhook + 外卖管理模块（2026-03-05）

### 核心目标

- 把 UberEats 鉴权升级为 **Asymmetric Key / client_assertion**，减少对 `client_secret` 的依赖。
- 增加 UberEats **实时推送 Webhook** 接口，支持事件接收与签名校验。
- 在主站新增 **外卖管理模块**（Delivery Management），用于菜单与接单管理。

### 新增/修改文件

- `lib/server/ubereats-client-assertion.ts`
- `app/api/integrations/ubereats/start/route.ts`
- `app/api/integrations/ubereats/callback/route.ts`
- `app/api/integrations/ubereats/status/route.ts`
- `app/api/webhooks/ubereats/route.ts`
- `lib/server/ubereats-webhook-store.ts`
- `lib/delivery-management-types.ts`
- `lib/server/delivery-management-store.ts`
- `app/api/delivery/management/route.ts`
- `components/delivery/DeliveryManagementClient.tsx`
- `app/(dashboard)/delivery/page.tsx`
- `components/layout/Sidebar.tsx`
- `components/layout/Navbar.tsx`
- `middleware.ts`
- `.env.example`
- `docs/UBEREATS_INTEGRATION_SETUP_ZH.md`

### 修改目的

1. **client_assertion 自动签 JWT + 换 token**
   - 服务端按 `iss/sub=UBEREATS_CLIENT_ID`、`aud=auth.uber.com`、`kid=UBEREATS_ASYMMETRIC_KEY_ID` 自动生成 JWT assertion。
   - OAuth 回调换 token 时优先走 client_assertion；如配置回退，可继续使用 `client_secret`。
   - Server token 模式下，支持直接 `client_credentials` + assertion 自动拉 token。

2. **Webhook 实时事件接入**
   - 新增 `POST /api/webhooks/ubereats`。
   - 支持 `x-uber-signature`（sha256）校验，签名 key 来自 `UBEREATS_WEBHOOK_SIGNING_KEY`（或回退 `UBEREATS_CLIENT_SECRET`）。
   - 事件写入 `.runtime/ubereats/webhook-events.json`，可通过 `GET /api/webhooks/ubereats?limit=20` 查看最近事件。

3. **外卖管理模块**
   - 新增 `/delivery` 页面，包含：
     - 平台连接与接单开关（暂停/恢复）
     - 菜单通道价格与上架状态管理
     - 订单履约看板（新单→接单→制作→待取→完成）
     - 自动化策略（自动接单阈值、队列阈值等）
     - Webhook 实时事件面板
   - 新增后端状态接口 `GET/PATCH /api/delivery/management`，按用户持久化到 `.runtime/delivery-management/*.json`。

### 验证

- 执行：`npm run build`
- 结果：构建通过，新增路由包含：
  - `/delivery`
  - `/api/delivery/management`
  - `/api/webhooks/ubereats`

---

## 阶段 K：Conversational Ops 执行适配层 + 补偿队列（2026-03-06）

### 核心目标

- 将 `ops-copilot` 从纯模拟执行升级为“真实平台适配 + 失败补偿重试”。
- 以 UberEats 作为首个真实写回平台，其他平台保留占位并显式失败提示。

### 新增/修改文件

- `lib/server/ops-platform-executor.ts`
- `lib/server/ops-retry-queue-store.ts`
- `lib/server/ops-copilot-engine.ts`
- `app/api/ops/commands/route.ts`
- `app/api/ops/commands/[commandId]/route.ts`
- `components/ops/ConversationalOpsClient.tsx`
- `.env.example`
- `docs/PRODUCT_MODULES_ZH.md`
- `docs/PRODUCT_MODULES_EN.md`

### 修改目的

1. **平台执行适配层（UberEats 优先）**
   - 新增 `executePlatformChanges()` 执行入口。
   - UberEats 真实写回由服务端调用 `UBEREATS_MENU_MUTATION_ENDPOINT`（Bearer token 走现有 OAuth/store）。
   - 返回统一结果：`success/retryable/message/httpStatus/appliedChanges`。

2. **失败补偿重试队列**
   - 新增 `.runtime/ops-retry-queue/*.json` 按用户持久化。
   - 对可重试错误（429/5xx/网络异常）自动入队并指数回退重试（1/3/10/30 分钟）。
   - 重试结果会回写到命令状态与平台结果，并更新审计轨迹。

3. **命令状态增强**
   - `platformResults` 新增重试可视字段：`retryable / attempts / nextRetryAt`。
   - 命令新增 `retryQueueSize`，用于前端显示当前待重试规模。
   - 回滚动作会自动清理该命令关联的重试任务，避免回滚后又被重试覆盖。

4. **API 读请求自动处理到期重试**
   - `GET /api/ops/commands` 与 `GET /api/ops/commands/[commandId]` 会先处理到期重试任务，再返回最新状态。

5. **前端可观测性增强**
   - 对话式执行页面新增“重试队列数量”标识。
   - 平台结果卡片新增 `RETRY` 状态、重试次数和下次重试时间展示。

### 环境变量新增

- `UBEREATS_MENU_MUTATION_ENDPOINT=`（UberEats 菜单写回 endpoint）
- `OPS_RETRY_MAX_ATTEMPTS=4`（补偿重试最大次数）

### 本轮结论

- Conversational Ops 已具备“可执行 + 可补偿”的后端闭环能力。
- 当前真实写回能力优先支持 UberEats；其他平台仍为占位适配器，后续按平台 API 能力逐步补齐。

---

## 阶段 L：Uber 新订单全局弹窗 + 订单动作 API + 三路订单源合并（2026-03-08）

### 核心目标

- 修复“Test Store 有新单但后台不显示”的高频问题。
- 无论用户停留在后台哪个页面，都能收到新订单弹窗提醒并可直接操作。
- 将订单数据源升级为“本地状态 + Webhook + 实时查询”三路融合，降低漏单风险。

### 新增/修改文件

- `lib/server/ubereats-order-normalizer.ts`（新增）
- `lib/server/delivery-order-actions.ts`（新增）
- `app/api/delivery/orders/[orderId]/actions/route.ts`（新增）
- `components/delivery/GlobalDeliveryOrderAlert.tsx`（新增）
- `components/layout/DashboardShell.tsx`
- `app/api/delivery/management/route.ts`
- `lib/server/delivery-order-query.ts`
- `.env.example`
- `docs/PRODUCT_MODULES_ZH.md`
- `docs/PRODUCT_MODULES_EN.md`

### 修改目的

1. **Webhook 订单标准化解析（防止 payload 形态差异导致漏单）**
   - 新增 `ubereats-order-normalizer`，把 Uber webhook 的多种字段结构统一解析成内部订单模型。
   - 解析结果可直接用于订单看板和查询接口。

2. **新增订单动作 API（与 Uber 动作对齐）**
   - 新增 `POST /api/delivery/orders/[orderId]/actions`。
   - 支持动作：`accepted / preparing / ready / completed / cancelled`。
   - 若配置了 `UBEREATS_ORDER_ACTION_ENDPOINT_TEMPLATE`，优先真实写回 Uber；未配置时本地回写并返回 warning。

3. **全局新订单弹窗（跨页面提醒）**
   - `DashboardShell` 接入 `GlobalDeliveryOrderAlert`。
   - 在后台页面轮询订单流，发现新单即弹窗，支持一键接单/取消/进入外卖管理页。

4. **三路订单源合并（本地 + Webhook + 实时查询）**
   - `Delivery Management` GET/PATCH 响应合并 webhook 订单，并追加实时查询结果作为兜底。
   - 即使 webhook 延迟或平台返回结构变化，订单看板仍能尽量显示真实新单。

### 验证说明

- 由于当前执行环境缺少 `node/npm`（命令不可用），本轮未在本地运行 `npm run build`。
- 已完成静态代码自检，下一步应在服务器或具备 Node 环境的机器执行：
  - `npm run build`
  - 用 sandbox 店铺下单验证：新单弹窗、订单看板、订单动作 API 全链路。

---

## 阶段 M：分析中心深度化（运营数据分析 + 商家分析/对比）(2026-03-11)

### 核心目标

- 在分析中心补齐“上传后可读可执行”的运营分析输出；
- 把“地址输入 -> 商家定位 -> 分析/对比”做成统一入口，支持更完整的商圈/口碑/竞对分析结果。

### 新增/修改文件

- `components/analysis/AnalysisClient.tsx`
- `app/api/analysis/route.ts`
- `app/api/analysis/address-autocomplete/route.ts`（新增）
- `lib/api/analysis.ts`
- `lib/server/business-intel-analysis.ts`
- `lib/server/adapters/nova-act-market-scan.ts`（新增）
- `lib/types.ts`
- `docs/PRODUCT_MODULES_ZH.md`
- `docs/PRODUCT_MODULES_EN.md`

### 修改目的

1. **运营数据分析面板**
   - 上传区新增“运营数据分析”入口；
   - 分析结果可展示解析清洗进度、数据健康度、关键洞察与可执行建议。

2. **商家定位与分析入口增强**
   - 新增地址自动补全接口：`POST /api/analysis/address-autocomplete`（Google Places + fallback）；
   - 分析入口支持“分析 / 对比”双模式，便于做基线差异判断。

3. **业务情报输出结构扩展**
   - `BusinessIntelSnapshot` 新增：
     - `reviewDeepDive`
     - `consumerProfile`
     - `competition`
     - `platformIntel`
     - `comparison`
   - 对比模式会结合上传运营数据与外部数据给出优先级差距清单。

4. **Nova Act 适配预留**
   - 增加 `nova-act-market-scan` 适配器；
   - 支持环境变量开关真实抓取与安全回退输出，避免无配置时阻塞分析链路。

### 验证

- 执行：`npm run build`
- 结果：构建通过（Next.js 16.1.6 + TypeScript 校验通过）。

---

## 阶段 N：分析入口交互回调（Business Name 选择模式）(2026-03-11)

### 核心目标

- 将分析入口从“地址自动补全下拉”改回“地址检索后返回商家名候选列表”的操作模式；
- 保留阶段 M 的新分析逻辑与对比逻辑不变。

### 新增/修改文件

- `components/analysis/AnalysisClient.tsx`
- `docs/PRODUCT_MODULES_ZH.md`
- `docs/PRODUCT_MODULES_EN.md`

### 修改目的

1. **入口体验一致性**
   - 恢复为：
     - 输入地址
     - 点击“搜索商家”
     - 返回候选 business name 列表
     - 选择后执行“分析/对比”。

2. **后端能力保持升级版**
   - 不回退 `compareMode`、深度情报字段与运营数据分析面板；
   - 仅调整前端输入交互，不影响分析结果结构。

### 验证

- 执行：`npm run build`
- 结果：构建通过。
