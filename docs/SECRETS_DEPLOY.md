# 密钥安全部署说明

所有 API Key 和密钥**仅通过环境变量**配置，**不要**写入代码或提交到 Git。

## 本地开发

1. 在项目根目录创建 `.env.local`（已被 `.gitignore` 忽略）：
   ```bash
   cp .env.example .env.local
   ```
2. 用编辑器打开 `.env.local`，填入真实 key。

### Nova 相关变量

| 变量名 | 说明 | 示例格式 |
|--------|------|----------|
| `AWS_NOVA_API_KEY` 或 `NOVA_API_KEY` | Bedrock/Nova API Key（ABSK 开头） | `ABSK...` |
| `NOVA_API_KEY` | 若使用其他 Nova 网关的 key | 按网关要求 |
| `AWS_REGION` | 区域 | `us-east-1` |
| `AWS_NOVA_ACT_ENABLED` | 是否启用 Nova Act 自动化 | `true` / 不设 |

- 项目内 Nova 调用会优先使用 **以 ABSK 开头的 key**（Bedrock 风格）；若 key 不是该格式，会打日志并视为未配置。
- 你有两套 key 时：
  - **ABSK 开头的 key** → 填到 `AWS_NOVA_API_KEY` 或 `NOVA_API_KEY`。
  - **UUID 格式的 key** → 若网关要求用该 key，可填到 `NOVA_API_KEY`（并确认当前代码或网关是否支持该格式）。

## 服务器部署（如 PM2）

**不要**在 `ecosystem.config.js` 或任何会被 commit 的文件里写真实 key。

### 方式一：服务器上的 .env 文件（推荐）

1. SSH 到服务器后，在应用目录创建 `.env`：
   ```bash
   cd /var/www/restaurantiq   # 或你的部署目录
   nano .env
   ```
2. 在 `.env` 中只写变量，例如：
   ```bash
   AWS_NOVA_API_KEY=你的ABSK密钥
   NOVA_API_KEY=你的Nova密钥（如需要）
   AWS_REGION=us-east-1
   ```
3. 用 PM2 时，在 `ecosystem.config.js` 里通过 `env_file: '.env'` 加载（若 PM2 版本支持），或使用下面的方式二。

### 方式二：PM2 环境变量

在 `ecosystem.config.js` 中**不要**写 key 明文，而是从环境或保密文件读入：

```javascript
// 示例：从服务器上仅 root/部署用户可读的文件读入（需自行创建该文件）
require('dotenv').config({ path: '/var/www/restaurantiq/.env' });
module.exports = {
  apps: [{
    name: 'restaurantiq',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/restaurantiq',
    env: {
      NODE_ENV: 'production',
      AWS_NOVA_API_KEY: process.env.AWS_NOVA_API_KEY,
      NOVA_API_KEY: process.env.NOVA_API_KEY,
      AWS_REGION: process.env.AWS_REGION,
    },
  }],
};
```

然后在服务器上确保 `/var/www/restaurantiq/.env` 存在且权限为 `600`：
```bash
chmod 600 /var/www/restaurantiq/.env
```

### 方式三：托管平台（Vercel / Railway / 等）

在对应项目的 **Settings → Environment Variables** 里添加：

- `AWS_NOVA_API_KEY` 或 `NOVA_API_KEY`
- `AWS_REGION`

不要将 key 写在代码或公开文档中。

## 安全检查清单

- [ ] 所有 key 只存在于 `.env.local` / 服务器 `.env` / 托管平台环境变量中
- [ ] `.env*` 已在 `.gitignore` 中（本项目已配置）
- [ ] 未在代码、README 或提交历史中提交真实 key
- [ ] 服务器上 `.env` 权限为 `600`，仅部署用户可读
