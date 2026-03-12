# RestaurantIQ Agents

独立的 Python 多智能体编排服务骨架，供 `agenttune.restaurantiq.ai` 的图形化配置和主站分析/执行流程逐步接入。

## 目标
- 作为现有 Next.js 单体应用之外的独立 orchestration backend
- 提供 Agent Registry、DAG Pipeline、Supervisor、Snapshot/Rollback、WebSocket 状态流
- 与主站通过 HTTP/WebSocket 通信，而不是直接替换当前线上逻辑

## 快速启动
```bash
cd restaurantiq-agents
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## Docker 启动
```bash
cd restaurantiq-agents
docker compose up --build
```

## 当前运行方式说明
- 当前这套服务是 **并行编排服务**，不是直接替换现有 `Next.js` 生产分析运行时
- 默认数据库使用 `sqlite`，方便本地单机启动
- 在容器/生产环境下可通过 `.env` 将 `DATABASE_URL` 覆盖为 PostgreSQL
- 当前 DAG 执行器是框架无关的第一版实现，后续可在不改 API 契约的前提下接入 LangGraph durable execution

## 当前状态
- 已提供可运行骨架
- 默认使用内存状态存储，可选 Redis
- Supervisor / Analyzer 现在优先走 OpenAI，未配置 `OPENAI_API_KEY` 时会自动回退 deterministic 逻辑
- 适合作为 v3.0 架构的第一阶段落地基础
