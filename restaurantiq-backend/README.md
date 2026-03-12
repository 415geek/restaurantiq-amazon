# RestaurantIQ Backend (NestJS)

Unified backend API gateway for RestaurantIQ V2.1.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                          │
│  (restaurantiq.ai:3000)                                      │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP + WebSocket
┌────────────────▼────────────────────────────────────────────┐
│              NestJS Backend (:4000)                          │
│  - All delivery platform OAuth/Webhook/API integration        │
│  - PostgreSQL (Prisma) + Redis                               │
│  - WebSocket Gateway (Socket.io)                             │
│  - Anthropic + OpenAI dual engine                            │
│  - Proxy to Python Agent service                             │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP (internal)
┌────────────────▼────────────────────────────────────────────┐
│           Python Agent Microservice (:8000)                  │
│  - FastAPI + LangGraph DAG orchestration                     │
│  - 14 Agents (Collector/Analyzer/Executor)                   │
│  - Amazon Nova Act browser automation                        │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Python 3.11+ (for Agent service)

## Installation

```bash
cd restaurantiq-backend
npm install
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp ../.env.local .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `ANTHROPIC_API_KEY` - Claude API key
- `OPENAI_API_KEY` - OpenAI API key
- `UBEREATS_CLIENT_ID` - Uber Eats client ID
- `UBEREATS_CLIENT_SECRET` - Uber Eats client secret

## Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio
npm run prisma:studio
```

## Development

```bash
# Start development server
npm run start:dev

# Start with debug
npm run start:debug
```

The server will start on `http://localhost:4000`.

## API Endpoints

### Orders
- `GET /api/v1/orders` - List orders
- `GET /api/v1/orders/:id` - Get order details
- `POST /api/v1/orders/:id/accept` - Accept order
- `POST /api/v1/orders/:id/start-prep` - Start preparation
- `POST /api/v1/orders/:id/ready` - Mark ready
- `POST /api/v1/orders/:id/complete` - Complete order
- `POST /api/v1/orders/:id/cancel` - Cancel order

### Uber Eats
- `GET /api/v1/ubereats/auth/status` - Get OAuth status
- `POST /api/v1/ubereats/auth/disconnect` - Disconnect

### Webhooks
- `POST /api/webhooks/ubereats` - Uber Eats webhook

### Analysis
- `POST /api/v1/analysis/run` - Run analysis
- `GET /api/v1/analysis/latest` - Get latest analysis
- `GET /api/v1/analysis/daily-briefing` - Get daily briefing

### Executions
- `POST /api/v1/executions` - Create execution
- `GET /api/v1/executions/:id` - Get execution details
- `POST /api/v1/executions/:id/approve` - Approve execution
- `POST /api/v1/executions/:id/rollback` - Rollback execution

### Social
- `GET /api/v1/social/reviews` - Get reviews
- `POST /api/v1/social/reviews/:id/reply` - Reply to review
- `POST /api/v1/social/reviews/:id/ai-reply` - AI-generated reply

## WebSocket

Connect to `ws://localhost:4000/orders` for real-time order updates.

Events:
- `order:new` - New order received
- `order:updated` - Order status updated
- `order:cancelled` - Order cancelled

## LLM Routing

Three-tier model routing strategy:

| Tier | Primary Model | Fallback Model | Use Case |
|------|--------------|----------------|----------|
| Fast | Claude Haiku 4.5 | GPT-4o-mini | Data structuring, execution agents |
| Balanced | Claude Sonnet 4.6 | GPT-4o | Factor analysis, daily briefing |
| Powerful | Claude Opus 4.6 | GPT-4o | Comprehensive decision, Impact Score |

## Testing

```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Run with coverage
npm run test:cov
```

## Building for Production

```bash
npm run build
npm run start:prod
```

## Project Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── common/                    # Common utilities
│   ├── guards/                # Auth guards
│   ├── interceptors/          # Interceptors
│   ├── filters/               # Exception filters
│   └── crypto/                # Token encryption
├── database/                  # Prisma database
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── redis/                     # Redis cache
│   ├── redis.module.ts
│   └── redis.service.ts
├── ubereats/                  # Uber Eats integration
│   ├── ubereats.module.ts
│   ├── ubereats.controller.ts
│   ├── ubereats.service.ts
│   ├── ubereats-token.service.ts
│   └── ubereats-webhook.controller.ts
├── delivery/                  # Unified order management
│   ├── delivery.module.ts
│   ├── delivery.controller.ts
│   ├── delivery.service.ts
│   └── delivery.gateway.ts    # WebSocket
├── llm/                       # LLM services
│   ├── llm.module.ts
│   ├── anthropic.service.ts   # Claude
│   ├── openai.service.ts      # OpenAI
│   └── llm-router.service.ts  # Three-tier routing
├── agents/                    # Agent proxy
│   ├── agents.module.ts
│   ├── agents.controller.ts
│   └── agents-proxy.service.ts
├── analysis/                  # Analysis module
│   ├── analysis.module.ts
│   ├── analysis.controller.ts
│   └── analysis.service.ts
├── execution/                 # Execution engine
│   ├── execution.module.ts
│   ├── execution.controller.ts
│   └── execution.service.ts
└── social/                    # Social media
    ├── social.module.ts
    ├── social.controller.ts
    └── social.service.ts
```

## Migration Status

### Phase 0: Infrastructure ✅
- [x] NestJS project setup
- [x] Prisma schema
- [x] Redis service
- [x] Module structure

### Phase 1: Orders (P0) 🚧
- [ ] UberEats OAuth migration
- [ ] UberEats Webhook handler
- [ ] WebSocket Gateway
- [ ] Order management APIs

### Phase 2: LLM Dual Engine 🚧
- [x] Anthropic service
- [x] OpenAI service
- [x] Three-tier router
- [ ] Agent integration

### Phase 3: Platform Expansion ⏳
- [ ] DoorDash integration
- [ ] GrubHub integration
- [ ] Nova Act setup

### Phase 4: Analysis & Execution ⏳
- [ ] Analysis module
- [ ] Execution engine
- [ ] Rollback mechanism

### Phase 5: Finalization ⏳
- [ ] Cleanup old code
- [ ] Security audit
- [ ] Production deployment

## License

UNLICENSED