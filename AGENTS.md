# Mosslight 维护说明

这是方向一“轻量生存 / 随机成长”的首作。项目根目录就是本目录，所有新增代码、资源和开发记录保存在这里。

- 先读 PRODUCT.md、DESIGN.md、docs/GAME_DESIGN.md、docs/ARCHITECTURE.md。
- 界面与说明使用中文；保留原生 JavaScript / Canvas 和零运行时依赖，不随意引入框架。
- 游戏规则在 src/core.js；不得把 DOM、音频或存储耦合进去。
- 美术保持原创程序化场景；外部资源必须附来源与授权，禁止复制许可不明的素材。
- 修改玩法同步设计文档，修改功能同步 CHANGELOG.md，发布后更新 docs/RELEASE.md。
- 游戏脚本或样式更新时提升 package.json / package-lock.json 版本并同步页脚，构建会以该版本刷新完整模块图缓存。
- 提交前：npm test、npm run test:browser、npm run build；检查桌面、手机、升级和结算。
- 凭据仅通过本机既有 helper 或环境变量临时使用。禁止把令牌写进文件、Git remote URL、日志或提交。
- 不覆写未知的远端仓库，不强推。GitHub 与 Gitee 各自记录推送和公开状态。
- 真实移动设备兼容性与难度仍需收集玩家反馈，不能把自动化结果写成真人评测。
