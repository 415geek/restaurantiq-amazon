# RestaurantIQ Multi-Agent Orchestration v3 迁移设计（中文版）

- 文档更新时间：2026-03-01 17:30:00 PST
- 适用对象：后端 AI 架构、平台研发、内部 AgentTune 维护人员
- 目标：在不破坏当前线上 `Next.js` 单体的前提下，引入一套可独立演进的 `Python FastAPI + DAG + Supervisor` 多智能体编排服务

## 1. 为什么不直接重写现有运行时

当前线上系统已经承担三类职责：
- 用户界面与业务工作流（官网、Dashboard、Analysis、Settings、Social Radar）
- 现有分析/执行 API
- 内部 `agenttune.restaurantiq.ai` 可视化 Agent 配置界面

如果直接把当前 `Next.js` 里的分析 runtime 全部替换成新的 LangGraph 风格 orchestrator，风险太高：
- 会同时影响上传分析、Dashboard 同步、执行预览、回滚流程
- 现有 AgentTune 前端还没有真正和后端 DAG 引擎解耦
- 新增 Python 栈后，部署链和监控链也需要单独补齐

因此 v3 的正确落地方式是：

1. **先并行搭一套独立 orchestrator 服务**
2. **保留当前 Next.js 运行时继续对外服务**
3. **通过 API / WebSocket 逐步把 Analysis 与 AgentTune 接到新服务**

## 2. 当前仓库里的落地位置

新增的并行服务目录：

`/Users/c8geek/Desktop/dineradar/boaura/iqproject/restaurantiq-agents`

这套服务负责：
- Agent Registry
- DAG Pipeline
- Supervisor
- Snapshot / Rollback
- Agent CRUD / Pipeline CRUD / Query API / WebSocket

当前主站继续负责：
- 用户可见页面
- `agenttune.restaurantiq.ai` 的 React 管理界面
- 既有上传分析、执行预览、回滚交互

## 3. 架构边界

### 3.1 当前主站（Next.js）保留职责
- UI
- Clerk 鉴权
- 子域访问控制
- AgentTune 画布编辑
- 当前生产分析入口与业务 API

### 3.2 新 Python Orchestrator 负责职责
- 多 Agent 图结构解释
- 路由规划 / DAG 执行
- Agent 生命周期与指标
- 执行快照与回滚元数据
- 未来接入 Redis / PostgreSQL / Worker Queue

## 4. v3 第一阶段已经落地的骨架

已完成：
- `app/models/*`：Agent、Pipeline、Task、Recommendation、Execution 模型
- `app/state/store.py`：Redis 优先、内存回退状态存储
- `app/state/snapshot.py`：执行快照与回滚窗口
- `app/agents/base.py`：统一 Agent 生命周期
- `app/agents/registry.py`：动态注册与热更新
- `app/agents/*`：A/B/C/D 与 Executor 基础实现
- `app/orchestrator/router.py`：deterministic 路由器
- `app/orchestrator/dag_pipeline.py`：拓扑层并行执行器
- `app/orchestrator/supervisor.py`：总编排入口
- `app/orchestrator/default_pipeline.py`：默认标准运营 DAG
- `app/api/*`：Agent、Pipeline、Execution、WebSocket API
- `app/main.py`：FastAPI 入口与运行时装配
- `docker-compose.yml`：orchestrator + redis + postgres

## 5. 当前仍然是“骨架”而不是“生产切换”的部分

还没做完的关键项：
- AgentTune 画布配置与 Python `PipelineConfig` 的双向同步
- Analysis 页面直接调用 Python orchestrator，而不是当前 TypeScript runtime
- LLM 级别的 Supervisor / Planner 统一接 OpenAI（当前优先 OpenAI Responses API）
- 任务异步化（Redis Streams / Celery / Dramatiq / LangGraph durable execution）
- PostgreSQL 持久化真正入库，而非仅保留 ORM 模型
- 审计日志、版本回滚、tenant 隔离细化

## 6. 建议的接入顺序

### Phase 1：并行服务可启动
- 已完成
- 验证：`uvicorn app.main:app --reload --port 8000`

### Phase 2：AgentTune 对接 Python CRUD
- 让 `agenttune.restaurantiq.ai` 的画布保存，不只写 `.runtime/agent-studio/graph.json`
- 同时写入 Python orchestrator 的 `/api/pipelines/current`

### Phase 3：Analysis 路由灰度切流
- 增加开关：`USE_PYTHON_ORCHESTRATOR=true`
- Analysis 请求先复制一份到 Python orchestrator 做 shadow run
- 对比 TypeScript runtime 与 Python runtime 输出

### Phase 4：执行链迁移
- 将 Analyzer 输出和 Executor preview 全部从 Python orchestrator 生成
- 当前 Next.js 只负责展示与 HITL 交互

### Phase 5：异步任务与持久化
- Redis Streams / Queue
- PostgreSQL pipeline/execution/audit 持久化
- 历史 run 回放与 trace UI

## 7. 新研发接手建议

如果新同学要继续这条线，第一优先级不是再加页面，而是：
1. 把 AgentTune graph 和 `PipelineConfig` 彻底对齐
2. 给 Python orchestrator 加集成测试
3. 做 Next.js → Python orchestrator 的 shadow invocation
4. 再考虑 LangGraph / CrewAI / Agents SDK 的进一步替换

## 8. 当前结论

v3 的正确方向不是“把现有 TypeScript 分析函数继续越写越大”，而是：
- 把编排层独立出来
- 让 UI、业务 API、orchestrator 解耦
- 先并行落地，再灰度切流

当前仓库已经具备这个迁移起点。

## 9. AgentTune 与 Python Orchestrator 的当前同步方式（2026-03-01 PST）

当前 `agenttune.restaurantiq.ai` 的画布保存已经进入“本地 graph + Python pipeline 双写”阶段：

1. `Next.js` 内部管理台仍然把图配置保存到：
   - `.runtime/agent-studio/graph.json`
2. 保存成功后，服务端会继续把当前 graph 映射为 Python `PipelineConfig`，再同步到：
   - `POST /api/pipelines/current`
3. 只有本地 graph 已经保存成功后才会尝试同步 Python orchestrator。
4. 如果 Python orchestrator 没配置：
   - 当前保存请求仍然成功
   - 同步逻辑会跳过，不影响内部管理台使用
5. 如果 Python orchestrator 已配置但同步失败：
   - 前端会收到明确保存失败原因
   - 本地 graph 仍然已经落盘
   - 当前 UI 会自动退回本地草稿模式，避免误以为“已发布到编排引擎”

这一阶段的目的：

1. 不破坏已经在线的 AgentTune 内部配置台
2. 先打通 `graph -> PipelineConfig` 的映射与同步协议
3. 为下一阶段“Python orchestrator shadow run / 真正切流”做准备

相关代码：

- Next 同步入口：
  - `/Users/c8geek/Desktop/dineradar/boaura/iqproject/app/api/agent-management/graph/route.ts`
- Next graph -> Python pipeline 映射：
  - `/Users/c8geek/Desktop/dineradar/boaura/iqproject/lib/server/python-orchestrator-sync.ts`
- Python pipeline 接收接口：
  - `/Users/c8geek/Desktop/dineradar/boaura/iqproject/restaurantiq-agents/app/api/pipelines.py`

## 10. Python Orchestrator 当前新增的接入保护

为了避免主站或外部脚本直接改写 Python orchestrator 配置，当前这套并行服务已加最小鉴权：

1. 环境变量：
   - `INTERNAL_API_KEY`
2. 请求头：
   - `x-orchestrator-key`
3. 当前受保护接口：
   - `/api/agents/*`
   - `/api/pipelines/*`
   - `/api/executions/*`

这样做的目的：

1. 允许 `Next.js` 内部服务做 server-to-server 同步
2. 避免把并行 orchestrator 直接暴露成无认证写接口
3. 后续可以平滑升级成更完整的 service auth / mTLS / internal gateway

## 11. 本轮已落地到代码的 v3 升级（2026-03-01 PST）

### 11.1 已经进入默认 DAG 的新节点

当前 Python orchestrator 默认 pipeline 已包含：

1. `ops`
2. `social`
3. `macro`
4. `fusion`
5. `planner`
6. `validator`
7. `exec_price`
8. `exec_mkt`
9. `exec_social`
10. `exec_review`

当前默认 DAG：

`ops/social/macro -> fusion -> planner -> validator -> executors`

并新增旁路：

`fusion -> validator`

目的：

1. Validator 需要同时看到 Planner 计划和 Fusion KPI/健康评分
2. 避免前端渲染与策略计划发生上下文割裂

### 11.2 Planner / Validator 已经有真实实现

当前已新增并接入：

- `restaurantiq-agents/app/agents/planner_strategy.py`
- `restaurantiq-agents/app/agents/validator_output.py`

能力现状：

1. 优先走 OpenAI JSON Schema
2. OpenAI 不可用时回退 deterministic 版本
3. deterministic 版本已经满足当前产品推进需要，不会因为 LLM 不可用直接断链

### 11.3 AgentTune richer 参数已开始同步到 Python

当前 AgentTune 保存 graph 时，已经可以把以下 richer 配置同步给 Python orchestrator：

1. model / temperature / top_p / max_tokens
2. prompt / promptTemplate / fewShotExamples
3. tools / max_tool_calls
4. retry / timeout / batch
5. cron / trigger_events
6. planner / validator 节点类型

结论：

当前系统已经从“UI 画布与 Python 编排分离”进入“UI graph 驱动 Python pipeline”的可演进状态。

## 12. Complete Fix All Agents v3 修复结果（2026-03-01 PST）

本轮按照 `COMPLETE_FIX_ALL_AGENTS_v3.md` 的要求，先做了一次“稳定性收口”，目标不是新增更多节点，而是保证：

1. 主站 `Next.js` 能持续 `npm run build`
2. Python orchestrator 能持续 `python3 -m compileall`
3. 新旧 Agent 兼容层不再互相打架

本轮已经修复的点：

1. `analysis-orchestrator` 不再错误地通过 `AnalysisResponse['validatedPlan']['task_board']` 这类脆弱索引拿类型，而是直接依赖 `AgentDValidatorResult['validated_plan']`。
2. `agent-c-macro` / `agent-d-synthesis` 已修到兼容新的 `Agent A/B/C/D` 数据流，不再继续引用旧字段名。
3. `AgentCPlannerResult` 中字面量过死的字段已放宽，避免真实规划结果一进入编排层就被类型系统拒绝。
4. `Agent D Validator` 中 `data_requests.priority` 的归一化逻辑已拆分，避免把任务优先级和数据请求优先级混用。
5. `ops-document-parser` 的经营指标可选值改成 `undefined` 语义，保证 TypeScript 与运行时对象形状一致。

这一步的意义：

1. 让 v3 架构从“可以设计”变成“可以持续编译和部署”
2. 为下一阶段继续做：
   - Dashboard 消费 `frontendReady`
   - AgentTune 反向读取 Python `current pipeline`
   - Analysis 真正切到新 A/B/C/D 展示语义
   提供稳定基线
