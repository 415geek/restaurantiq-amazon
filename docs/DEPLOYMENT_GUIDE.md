# RestaurantIQ V2.1 部署指南

> **版本**: 2.1.0
> **更新时间**: 2026-03-12

---

## 📋 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                     │
│                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Next.js Front  │  │  NestJS Backend │  │ Python Agent │ │
│  │  (Port 3000)    │  │  (Port 4000)    │  │  (Port 8000) │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│         │                    │                    │          │
│         └────────────────────┼────────────────────┘          │
│                              │                               │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │              Nginx Reverse Proxy (Port 80/443)        │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │              PostgreSQL (Port 5432)                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │              Redis (Port 6379)                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 前置要求

### 服务器配置
- **CPU**: 4 cores minimum (8 cores recommended)
- **RAM**: 8GB minimum (16GB recommended)
- **Storage**: 50GB SSD minimum
- **OS**: Ubuntu 22.04 LTS or Debian 12

### 软件依赖
```bash
# Node.js 18+
node --version  # v18.x.x or higher

# PostgreSQL 14+
psql --version  # 14.x or higher

# Redis 7+
redis-server --version  # 7.x or higher

# Python 3.11+
python --version  # 3.11.x or higher

# Nginx
nginx -v  # 1.24.x or higher

# PM2
npm install -g pm2
```

---

## 📦 部署步骤

### 1. 克隆代码仓库

```bash
cd /var/www
git clone <repository-url> restaurantiq
cd restaurantiq
```

### 2. 安装依赖

```bash
# Next.js Frontend
npm install

# NestJS Backend
cd restaurantiq-backend
npm install
cd ..

# Python Agent
cd restaurantiq-agents
pip install -r requirements.txt
cd ..
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑环境变量
nano .env.local
```

**关键配置项**：
```bash
# ============= 基础 =============
NEXT_PUBLIC_APP_URL=https://restaurantiq.ai
NEXT_PUBLIC_API_URL=https://api.restaurantiq.ai
NEXT_PUBLIC_WS_URL=wss://api.restaurantiq.ai

# ============= 数据库 =============
DATABASE_URL=postgresql://user:password@localhost:5432/restaurantiq
REDIS_URL=redis://localhost:6379/0

# ============= 安全 =============
TOKEN_ENCRYPTION_KEY=<生成32字节hex>
INTERNAL_API_KEY=<生成强密码>

# ============= LLM =============
ANTHROPIC_API_KEY=<Claude API密钥>
OPENAI_API_KEY=<OpenAI API密钥>

# ============= Uber Eats =============
UBEREATS_CLIENT_ID=<生产环境Client ID>
UBEREATS_CLIENT_SECRET=<生产环境Client Secret>
UBEREATS_ENVIRONMENT=production
```

### 4. 初始化数据库

```bash
cd restaurantiq-backend

# 生成Prisma客户端
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate

# (可选) 打开Prisma Studio
npm run prisma:studio
```

### 5. 构建应用

```bash
# Next.js Frontend
npm run build

# NestJS Backend
cd restaurantiq-backend
npm run build
cd ..
```

### 6. 配置PM2

创建 `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'restaurantiq-frontend',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/restaurantiq',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/restaurantiq/frontend-error.log',
      out_file: '/var/log/restaurantiq/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
    },
    {
      name: 'restaurantiq-backend',
      script: 'npm',
      args: 'start:prod',
      cwd: '/var/www/restaurantiq/restaurantiq-backend',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      error_file: '/var/log/restaurantiq/backend-error.log',
      out_file: '/var/log/restaurantiq/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
    },
    {
      name: 'restaurantiq-agents',
      script: 'uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8000',
      cwd: '/var/www/restaurantiq/restaurantiq-agents',
      instances: 1,
      env: {
        PYTHONUNBUFFERED: '1',
      },
      error_file: '/var/log/restaurantiq/agents-error.log',
      out_file: '/var/log/restaurantiq/agents-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '2G',
    },
  ],
};
```

启动PM2：

```bash
# 启动所有应用
pm2 start ecosystem.config.js

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup
```

### 7. 配置Nginx

创建 `/etc/nginx/sites-available/restaurantiq`:

```nginx
# Frontend
server {
    listen 80;
    server_name restaurantiq.ai www.restaurantiq.ai;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name restaurantiq.ai www.restaurantiq.ai;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/restaurantiq.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/restaurantiq.ai/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /orders {
        proxy_pass http://localhost:4000/orders;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhooks
    location /webhooks/ {
        proxy_pass http://localhost:4000/webhooks/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Backend API Subdomain
server {
    listen 80;
    server_name api.restaurantiq.ai;
    
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.restaurantiq.ai;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.restaurantiq.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.restaurantiq.ai/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Backend API
    location / {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /orders {
        proxy_pass http://localhost:4000/orders;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhooks
    location /webhooks/ {
        proxy_pass http://localhost:4000/webhooks/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/restaurantiq /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

### 8. 配置SSL证书

```bash
# 安装Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d restaurantiq.ai -d www.restaurantiq.ai -d api.restaurantiq.ai

# 设置自动续期
sudo certbot renew --dry-run
```

### 9. 配置防火墙

```bash
# 允许HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 允许SSH
sudo ufw allow 22/tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### 10. 配置日志轮转

创建 `/etc/logrotate.d/restaurantiq`:

```
/var/log/restaurantiq/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 🔄 更新部署

### 1. 拉取最新代码

```bash
cd /var/www/restaurantiq
git pull origin main
```

### 2. 安装新依赖

```bash
npm install
cd restaurantiq-backend
npm install
cd ../restaurantiq-agents
pip install -r requirements.txt
cd ..
```

### 3. 运行数据库迁移

```bash
cd restaurantiq-backend
npm run prisma:migrate
cd ..
```

### 4. 重新构建

```bash
npm run build
cd restaurantiq-backend
npm run build
cd ..
```

### 5. 重启PM2

```bash
pm2 reload ecosystem.config.js
```

---

## 📊 监控

### PM2监控

```bash
# 查看所有应用状态
pm2 status

# 查看日志
pm2 logs

# 查看实时日志
pm2 logs --lines 100

# 监控面板
pm2 monit
```

### 系统监控

```bash
# CPU和内存
htop

# 磁盘使用
df -h

# 网络连接
netstat -tulpn

# PostgreSQL连接
psql -U postgres -c "SELECT * FROM pg_stat_activity;"
```

### 应用日志

```bash
# 前端日志
tail -f /var/log/restaurantiq/frontend-error.log
tail -f /var/log/restaurantiq/frontend-out.log

# 后端日志
tail -f /var/log/restaurantiq/backend-error.log
tail -f /var/log/restaurantiq/backend-out.log

# Agent日志
tail -f /var/log/restaurantiq/agents-error.log
tail -f /var/log/restaurantiq/agents-out.log
```

---

## 🔒 安全检查清单

- [ ] 所有API密钥已轮换
- [ ] SSL证书已配置并自动续期
- [ ] 防火墙已启用
- [ ] 数据库密码已加密
- [ ] OAuth tokens已加密存储
- [ ] CORS配置正确
- [ ] Rate limiting已启用
- [ ] 日志轮转已配置
- [ ] 备份策略已实施
- [ ] 监控告警已配置

---

## 🆘 故障排查

### 应用无法启动

```bash
# 检查PM2状态
pm2 status

# 查看错误日志
pm2 logs --err

# 检查端口占用
netstat -tulpn | grep -E ':(3000|4000|8000)'
```

### 数据库连接失败

```bash
# 检查PostgreSQL状态
sudo systemctl status postgresql

# 测试连接
psql -U postgres -d restaurantiq

# 检查连接数
psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

### Redis连接失败

```bash
# 检查Redis状态
sudo systemctl status redis

# 测试连接
redis-cli ping

# 查看Redis日志
sudo tail -f /var/log/redis/redis-server.log
```

### WebSocket连接失败

```bash
# 检查Nginx配置
sudo nginx -t

# 查看Nginx日志
sudo tail -f /var/log/nginx/error.log

# 检查防火墙
sudo ufw status
```

---

## 📞 支持

如遇问题，请联系：
- 技术支持: tech@restaurantiq.ai
- 紧急联系: emergency@restaurantiq.ai

---

**文档版本**: 1.0
**最后更新**: 2026-03-12