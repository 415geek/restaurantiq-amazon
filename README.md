# Restaurant IQ（IQproject）

Restaurant IQ 是一个面向餐饮运营的 SaaS 平台，核心能力包括：
- 多源数据整合（运营、评论、社媒、宏观因子）
- AI 建议生成与优先级排序
- 执行预览与滑动确认
- 执行后回滚窗口
- 社媒雷达（统一查看/回复评论与提及）
- 外卖平台接入（首个已接入：Uber Eats；未接通时保留上传文件 fallback）
- 智能日报（Dashboard 每日简报，优先调用 OpenAI，失败自动回退确定性摘要）

## 技术栈

- Next.js（App Router）
- TypeScript
- Tailwind CSS
- Clerk（鉴权/用户）
- Framer Motion（交互动画）

## 本地开发

```bash
npm install
cp .env.example .env.local
npm run dev
```

默认访问：
- 官网：`http://localhost:3000`
- 登录：`http://localhost:3000/sign-in`
- 后台：`http://localhost:3000/dashboard`

## 构建与运行

```bash
npm run build
npm run start
```

## 环境变量

请以 `.env.example` 为模板配置本地环境变量。

安全要求：
- 不要把真实密钥提交到 Git
- 服务端密钥仅在服务端路由/动作中使用
- 仅公开必要的 `NEXT_PUBLIC_*` 变量

## 部署（当前生产）

生产环境使用 PM2 管理进程：

```bash
npm run build
pm2 restart iqproject --update-env
```

完整交接与运维信息见：
- `docs/PROJECT_PROGRESS_LOG.md`
- `docs/GITHUB_TEAM_SETUP.md`
- `docs/UBEREATS_INTEGRATION_SETUP_ZH.md`
- `docs/PRODUCT_MODULES_ZH.md`
- `docs/PRODUCT_MODULES_EN.md`

文档维护约定：
- 每次功能变更后，同步更新中英文产品模块介绍文档并提交到 GitHub。
