# 开源与发布记录

日期：2026-11-21（Asia/Shanghai）。

## 状态

| 项目 | 状态 |
| --- | --- |
| 本地游戏 | 已完成，源码与启动入口在项目根 |
| 标准 / 练习、胜败、升级、触控 | 已实现并通过对应测试 |
| 开源许可证 | MIT；标题字体单独 OFL 1.1 |
| GitHub | main 已推送，公开；匿名 API 访问 HTTP 200 |
| Gitee | main 已推送，公开；匿名 API 访问 HTTP 200 |
| 在线试玩 | 已部署 GitHub Pages，HTTP 200，桌面与手机浏览器线上交互通过 |
| GitHub CI | Linux / Chromium 的 Checks 成功 |
| 独立复核 | 两项修复均为 Resolved，复核结论 ship（见 REVIEW.md 的范围限制） |

## 远端

- GitHub：https://github.com/yunhanhai/mosslight
- Gitee：https://gitee.com/yunhanhai/mosslight
- 在线试玩：https://yunhanhai.github.io/mosslight/

## 首次发布验证

- 游戏代码提交：`458683c89e05f9c2072728d572acad0115deb4d6`。后续发布记录提交只更新说明和验证资料。
- CI：https://github.com/yunhanhai/mosslight/actions/runs/44882761129 — success。
- Pages：https://github.com/yunhanhai/mosslight/actions/runs/44882761134 — attempt 2 success。
- 首次 Pages 任务因站点尚未启用而在 configure-pages 步骤失败，启用工作流型 Pages 后重跑成功，没有为绕过问题修改游戏。
- Gitee 初次创建时为私有，平台明确拒绝空仓库公开；首次推送后设置公开成功，已用未携带凭据的请求验证。
- 线上浏览器验证：桌面与手机均加载本地字体与脚本、进入游戏、显示三选一能力、选择后继续、暂停 / 继续；没有页面错误或资源 HTTP 错误。原始结果在 `online-verification.json`。

## 发布约定

- GitHub remote 名称 `origin`，Gitee remote 名称 `gitee`；主分支 `main`。
- 构建产物 `dist/` 不进入源码 Git；GitHub Pages 从工作流上传静态构建。
- 首次发布前执行测试、构建、截图、许可核对和暂存区凭据模式检查。
- 不使用强制推送，不覆盖既有不相关仓库。创建前已确认两端同名仓库不存在。
- 凭据通过本机原有 Git credential helper 临时读取，API 验证成功；未输出或写入令牌，remote 使用普通 HTTPS URL。
- 页面公开状态、CI 成功、在线可访问性分别验证；不能用“仓库创建”代替“代码推送”或“网页部署”。

## 后续更新

```powershell
npm test
npm run test:browser
npm run build
git add .
git commit -m "Describe the change"
git push origin main
git push gitee main
```

GitHub Pages 工作流会在推送 main 后部署。源码、文档与镜像需要同时推送两端，Gitee 不会自动接收 GitHub 的后续更新。
