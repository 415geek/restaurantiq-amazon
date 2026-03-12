# GitHub 团队配置清单

本仓库已在代码层包含：CI、PR/Issue 模板、CODEOWNERS、安全文档。
以下配置需要在 GitHub 控制台手动完成（无法通过代码直接提交）。

## 1）仓库可见性

- 路径：`Settings -> General -> Danger Zone`
- 要求：仓库保持 **Private（私有）**

## 2）主分支保护（`main`）

- 路径：`Settings -> Branches -> Add branch protection rule`
- 分支规则：`main`
- 建议开启：
  - Require a pull request before merging（合并前必须 PR）
  - Require approvals（至少 1 个审批）
  - Dismiss stale approvals（新提交后旧审批失效）
  - Require status checks to pass（状态检查通过后才能合并）
  - Required checks：`CI / build-and-lint`
  - Require conversation resolution（对话必须解决）
  - Include administrators（管理员也受保护）
  - Restrict who can push（可选，建议限制）

## 3）仓库 Secrets

- 路径：`Settings -> Secrets and variables -> Actions`
- 仅添加 CI/部署真正需要的密钥。
- 严禁把生产密钥写进仓库代码。

## 4）权限管理

- 路径：`Settings -> Collaborators and teams`
- 遵循最小权限原则：
  - Admin：创始人/平台负责人
  - Write：研发主力
  - Triage/Read：PM/设计/运营按需

## 5）可选安全增强

- 路径：`Settings -> Code security and analysis`
- 建议开启：
  - Dependabot alerts
  - Dependabot security updates
  - Secret scanning（若可用）

## 6）PR 默认行为

- 路径：`Settings -> General -> Pull Requests`
- 建议：
  - 按团队习惯允许 merge commits
  - 开启自动删除已合并分支（auto delete head branches）
