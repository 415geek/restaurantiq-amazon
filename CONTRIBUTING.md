# 贡献指南

## 分支规范

- 主分支：`main`
- 功能分支命名：`feature/<主题>` 或 `fix/<主题>`
- 不要直接向 `main` 提交，必须走 Pull Request。

## 提交 PR 前本地检查

```bash
npm ci
npm run lint
npm run build
```

## PR 要求

- 使用 PR 模板。
- 说明修改目的、影响范围、回滚方案。
- 涉及 UI 改动请附截图（前后对比）。
- 明确说明是否新增环境变量。
- 确认未提交任何密钥/令牌。
- 涉及产品功能代码变更时，必须同时更新中英文模块文档：
  - `docs/PRODUCT_MODULES_ZH.md`
  - `docs/PRODUCT_MODULES_EN.md`
  CI 会自动校验，不满足将阻止合并。

## Commit 建议

- 一次提交只做一类事情（原子化）。
- 提交信息清晰可读，例如：
  - `feat: 新增 meta oauth 回调处理`
  - `fix: 修复 social radar 回退逻辑`

## 安全基线

- `.env.local` 永远不进仓库。
- 私钥（SSH、API Secret）不可入库。
- 涉及真实密钥的第三方调用必须放服务端。
