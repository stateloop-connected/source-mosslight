# 开源与发布记录

日期：2026-11-21（Asia/Shanghai）。

## 状态

| 项目 | 状态 |
| --- | --- |
| 本地游戏 | 已完成，源码与启动入口在项目根 |
| 标准 / 练习、胜败、升级、触控 | 已实现并通过对应测试 |
| 开源许可证 | MIT；标题字体单独 OFL 1.1 |
| GitHub | 已创建仓库，待完成首次推送与在线验证 |
| Gitee | 已创建仓库，待推送后再设置公开（平台不允许空仓库公开） |
| 在线试玩 | GitHub Pages 工作流已准备，待发布后验证 |

## 远端

- GitHub：https://github.com/yunhanhai/mosslight
- Gitee：https://gitee.com/yunhanhai/mosslight

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

GitHub Pages 工作流会在推送 main 后部署。发布完成后本记录将更新实际结果。
