# 第三方内容与许可证

## Ma Shan Zheng 标题字体

- 上游：https://github.com/google/fonts/tree/main/ofl/mashanzheng
- 作者与版权：以随附 OFL 文件为准。
- 授权：SIL Open Font License 1.1。
- 通过 Google Fonts 官方 CSS 的 text 子集接口获取，仅包含标题所需汉字。
- 文件：`assets/fonts/title.ttf`（TrueType；通过文件头核对格式）。
- 许可证原文：`assets/fonts/OFL-MaShanZheng.txt`。
- 获取日期：2026-11-21。

## 开发依赖

`@playwright/test`、`playwright`、`playwright-core` 用于浏览器测试，采用 Apache-2.0；版本与完整性由 `package-lock.json` 固定，不打包到游戏构建。

`prettier` 3.10.1 用于源码格式化，采用 MIT，不参与游戏运行与静态构建。

## 原创内容

`src/renderer.js` 中的地形、花叶、守夜人、虫影和粒子全部由本项目 Canvas 代码绘制。图标为本项目 SVG 路径，音效由 Web Audio 振荡器合成；没有外部图片、音频或生成式图片。

GitHub 游戏项目仅作为选题和工程方案参考，没有复制源码或素材。尤其是许可证未清楚识别的参考项目，不视为已获授权的内容来源。

`docs/screenshots/` 是本项目真实页面的 Playwright 截图；PNG 文件内已嵌入本地截取来源与日期，不是生成式图片或外部宣传素材。
