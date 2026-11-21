# 首作选题研究

研究日期：2026-11-21（Asia/Shanghai）。目标：首个完整网页游戏能独立运行、易维护、适合静态开源部署，并可继续扩展。

## 方法与来源

尝试公共网页搜索，并直接使用 GitHub 官方 REST API 检索仓库、核对元数据和 README。网页搜索接口没有返回可复用的正常引用，因此以下记录以直接核验的官方仓库为准，不根据搜索排序宣称市场热度。

1. **2048**：https://github.com/gabrielecirulli/2048 — MIT；README 明确是小型网页游戏，有本地最佳成绩和触屏适配经验。启发：即开即玩、成绩本地保存、电脑和手机共用入口。
2. **LittleJS**：https://github.com/KilledByAPixel/LittleJS — MIT；官方介绍为无依赖的轻量 HTML5 游戏引擎。启发：2D 网页游戏可以保持较小技术体积；首作不必引入大型框架。
3. **Canvas Vampire Survivors**：https://github.com/ricardo-foundry/canvas-vampire-survivors — 官方仓库描述为原生 JavaScript + HTML5 Canvas 的生存游戏；GitHub API 对许可证返回 `NOASSERTION`，本项目不使用其源码和资源。启发仅限“自动攻击、移动躲避、随机成长”可在静态网页实现。

`research-sources.json` 保存核验元数据。未保存第三方游戏源码，也未把仓库星数当作用户需求的证据。

## 方向比较

| 候选 | 优点 | 首作限制 | 结论 |
| --- | --- | --- | --- |
| 数字合并益智 | 实现小，测试清楚，手机友好 | 单纯做 2048 克隆辨识度较弱 | 适合后续独立机制实验 |
| 塔防 / 经营 | 可持续增加内容 | 寻路、关卡和平衡工作量大 | 留作后续方向 |
| 短局生存 / 随机成长 | 操作简单，反馈直接，成长组合可重复游玩 | 必须把敌我区分、手感和难度做清楚 | 首作选择 |

## 本次选择

**《苔光守夜》**：把题材放在月下花园，用萤火、晨露、苔叶与虫影组织玩法。原生 Canvas、完全自绘、默认离线运行，使用本地记录。标准 3 分钟，练习 90 秒。

这是一项基于开发范围和可维护性的编辑判断，不是经过玩家调研或商业验证的市场结论。首版完成后，最有价值的下一步是收集真实玩家对操作、升级节奏和难度的反馈。

## 技术资料

- Canvas 2D：https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
- Pointer Events：https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- Web Audio：https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- Playwright：https://playwright.dev/docs/intro
- GitHub Pages：https://docs.github.com/en/pages
