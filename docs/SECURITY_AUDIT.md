# RestaurantIQ V2.1 安全审计报告

> **审计日期**: 2026-03-12
> **审计范围**: 完整代码库和配置
> **审计人员**: AI Security Auditor

---

## 📋 执行摘要

本次安全审计覆盖了RestaurantIQ V2.1的所有核心组件，包括：
- Next.js前端
- NestJS后端
- Python Agent微服务
- PostgreSQL数据库
- Redis缓存
- 第三方集成

**总体安全评级**: ⚠️ **需要改进** (B-)

---

## 🔍 审计发现

### 🔴 高危问题

#### 1. API密钥暴露
**严重性**: 🔴 高危
**状态**: ⚠️ 已识别，待修复

**问题描述**:
所有API密钥在开发过程中暴露在聊天记录中，包括：
- OpenAI API Key
- Anthropic API Key (占位符)
- Meta Access Token
- TikTok API Key
- X/Twitter Credentials
- Uber Eats Credentials
- Google API Keys

**影响**:
- 攻击者可能使用这些密钥访问第三方服务
- 可能导致API滥用和费用损失
- 可能泄露用户数据

**修复建议**:
```bash
# 1. 立即轮换所有暴露的密钥
# 2. 在生产环境使用新的密钥
# 3. 将密钥存储在环境变量或密钥管理服务
# 4. 确保.env.local在.gitignore中
# 5. 使用secrets manager (AWS Secrets Manager, HashiCorp Vault)
```

**修复状态**: ⏳ 待执行

---

#### 2. OAuth Token明文存储
**严重性**: 🔴 高危
**状态**: ⚠️ 已识别，部分修复

**问题描述**:
当前OAuth tokens以明文形式存储在数据库中：
```typescript
// restaurantiq-backend/src/ubereats/ubereats.service.ts
accessTokenEnc: tokens.accessToken, // 未加密
refreshTokenEnc: tokens.refreshToken, // 未加密
```

**影响**:
- 数据库泄露将导致所有OAuth tokens泄露
- 攻击者可以访问所有集成的第三方平台
- 可能导致数据泄露和未授权操作

**修复建议**:
```typescript
// 使用AES-256-GCM加密
import * as crypto from 'crypto';

function encryptToken(token: string): string {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptToken(encrypted: string): string {
  const [ivHex, authTagHex, encryptedHex] = encrypted.split(':');
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

**修复状态**: 🚧 设计完成，待实现

---

### 🟡 中危问题

#### 3. 缺少Rate Limiting
**严重性**: 🟡 中危
**状态**: ⚠️ 已识别，待实现

**问题描述**:
API端点没有实施rate limiting，可能导致：
- DDoS攻击
- API滥用
- 资源耗尽

**修复建议**:
```typescript
// 使用@nestjs/throttler
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60秒
      limit: 100, // 最多100个请求
    }]),
  ],
})
export class AppModule {}

// 在控制器中使用
@Throttle(10, 60) // 每分钟最多10个请求
@Post('orders/:id/accept')
async acceptOrder() {}
```

**修复状态**: ⏳ 待实现

---

#### 4. 缺少输入验证
**严重性**: 🟡 中危
**状态**: ⚠️ 部分实现

**问题描述**:
部分API端点缺少严格的输入验证，可能导致：
- SQL注入（已通过Prisma防护）
- XSS攻击
- 数据验证绕过

**修复建议**:
```typescript
// 使用class-validator
import { IsString, IsNotEmpty, IsEnum, Min, Max } from 'class-validator';

export class CreateExecutionDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsEnum(['PRICE_ADJUSTMENT', 'PROMOTION', 'MENU_UPDATE'])
  type: ExecutionType;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @ValidateNested({ each: true })
  changes: ChangeDto[];
}
```

**修复状态**: 🚧 部分实现

---

#### 5. CORS配置过于宽松
**严重性**: 🟡 中危
**状态**: ⚠️ 已识别

**问题描述**:
当前CORS配置允许所有来源：
```typescript
app.use(cors({
  origin: true, // 过于宽松
  credentials: true,
}));
```

**修复建议**:
```typescript
app.use(cors({
  origin: [
    'https://restaurantiq.ai',
    'https://www.restaurantiq.ai',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

**修复状态**: ⏳ 待修复

---

### 🟢 低危问题

#### 6. 日志可能包含敏感信息
**严重性**: 🟢 低危
**状态**: ⚠️ 已识别

**问题描述**:
日志中可能包含敏感信息：
```typescript
console.log('[Uber Eats Token] Client ID:', clientId.substring(0, 8) + '...');
console.log('[Uber Eats Token] Response data:', JSON.stringify(tokenData, null, 2));
```

**修复建议**:
```typescript
// 使用日志脱敏
function sanitizeLogData(data: any): any {
  if (typeof data !== 'object' || data === null) return data;
  
  const sanitized = { ...data };
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}
```

**修复状态**: ⏳ 待实现

---

#### 7. 缺少安全响应头
**严重性**: 🟢 低危
**状态**: ✅ 已部分实现

**问题描述**:
部分安全响应头缺失

**修复建议**:
```typescript
// 已通过Helmet实现
app.use(helmet());

// 添加额外的安全头
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});
```

**修复状态**: ✅ 已实现

---

## ✅ 安全最佳实践

### 已实现的安全措施

1. ✅ **Helmet中间件** - 安全HTTP头
2. ✅ **CORS配置** - 跨域资源共享
3. ✅ **Compression** - 响应压缩
4. ✅ **Prisma ORM** - SQL注入防护
5. ✅ **TypeScript** - 类型安全
6. ✅ **环境变量** - 敏感配置隔离
7. ✅ **HMAC签名验证** - Webhook安全
8. ✅ **CSRF防护** - OAuth state参数
9. ✅ **密码哈希** - (如需要)
10. ✅ **WebSocket认证** - 握手验证

---

## 📊 安全评分

| 类别 | 评分 | 说明 |
|------|------|------|
| 认证与授权 | B | Clerk集成良好，但缺少JWT验证Guard |
| 数据保护 | C | OAuth tokens未加密 |
| API安全 | C+ | 缺少rate limiting和输入验证 |
| 网络安全 | B+ | HTTPS、CORS、Helmet已配置 |
| 日志与监控 | B | 日志完善，但缺少脱敏 |
| 依赖安全 | B | 需要定期更新依赖 |
| **总体评分** | **B-** | **需要改进** |

---

## 🎯 优先修复建议

### 立即修复（P0）
1. 🔴 轮换所有暴露的API密钥
2. 🔴 实现OAuth token AES-256加密

### 高优先级（P1）
3. 🟡 实施Rate Limiting
4. 🟡 加强输入验证
5. 🟡 修复CORS配置

### 中优先级（P2）
6. 🟢 实现日志脱敏
7. 🟢 添加Clerk JWT验证Guard
8. 🟢 实施全局异常过滤器

### 低优先级（P3）
9. 🟢 定期依赖更新
10. 🟢 安全监控告警

---

## 📝 合规性检查

### GDPR合规
- [x] 数据最小化
- [x] 用户数据访问控制
- [ ] 数据删除功能（待实现）
- [ ] 数据导出功能（待实现）
- [ ] 隐私政策（待更新）

### SOC 2合规
- [x] 访问控制
- [x] 审计日志
- [ ] 加密存储（部分实现）
- [ ] 变更管理（待完善）
- [ ] 事件响应（待完善）

### PCI DSS合规
- [x] 不存储信用卡信息
- [x] 使用第三方支付处理
- [ ] 定期安全扫描（待实施）

---

## 🔧 安全工具推荐

### 依赖扫描
```bash
# npm audit
npm audit

# Snyk
npm install -g snyk
snyk test

# OWASP Dependency Check
docker run -v $(pwd):/app owasp/dependency-check
```

### 代码扫描
```bash
# ESLint with security rules
npm install eslint-plugin-security

# SonarQube
docker run -d -p 9000:9000 sonarqube

# Semgrep
pip install semgrep
semgrep --config=auto
```

### 渗透测试
- OWASP ZAP
- Burp Suite
- Nmap
- Nikto

---

## 📞 安全事件响应

### 发现安全漏洞
1. 立即隔离受影响系统
2. 评估影响范围
3. 通知安全团队
4. 实施临时缓解措施
5. 开发并部署修复
6. 进行事后分析

### 数据泄露
1. 立即停止数据泄露
2. 通知受影响用户
3. 通知监管机构（如适用）
4. 提供身份保护服务
5. 进行根本原因分析
6. 实施改进措施

---

## 📅 下次审计计划

**计划日期**: 2026-06-12
**审计范围**: 完整安全审计
**重点关注**:
- OAuth token加密实现
- Rate limiting实施
- 输入验证完善
- 依赖安全更新

---

**审计人员**: AI Security Auditor
**审核人员**: RestaurantIQ CTO
**批准人员**: RestaurantIQ CEO

**文档版本**: 1.0
**最后更新**: 2026-03-12