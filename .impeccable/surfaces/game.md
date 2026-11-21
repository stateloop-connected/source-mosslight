# 游戏主画面

## Scope
index.html；Experience；中文桌面与手机玩家，直接进入花园体验。

## Direction contract
THESIS：整片实时苔床是作品，界面为它让路。
OWN-WORLD：松针绿、苔叶、淡金萤光、紫灰虫影；手写题字与轻量叶片控件。
STORY：看见花园，带萤火出发，收集与生长，守到黎明。
FIRST VIEWPORT：花园铺满主体，左侧标题与开始，右侧角色和虫影，记录在下沿。
FORM：月下生态缸；候选第六；seed:1a1d50b1c550b7fd。
FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## FORM
seed:1a1d50b1c550b7fd；第六方向“月下生态缸”：可探索的苔床占据首屏，界面退到边缘，能力像收集的植物标本。用户委托选择方向并先制作，本次直接实施，无额外审批轮。

## FIRST VIEWPORT
顶部小型品牌与工具；主画面是一整幅实时 Canvas 夜间苔床。左侧标题“借一点萤火，守到天亮。”和开始按钮叠在安静的土壤区，右侧实景展示守夜人、花簇、虫群与微光。底部记录带显示本地最佳成绩及玩法。真实画面做主角，不使用营销卡片阵列。

## Signature interaction
按下开始后标题退场，同一片花园无缝进入游戏；拾取微光时粒子归向角色，升级时暂停花园并打开三枚可键盘选择的能力标本。

## Behavior
移动、自动攻击、冲刺、升级、暂停、音效与结算完整闭环。手机保持可读 HUD，底部提供虚拟摇杆与冲刺键。隐藏页面自动暂停。

## Risk and constraints
纯程序化画面需要足够清晰的角色、敌人、地面层级；以轮廓和颜色双重区分。无闪烁、尊重减少动态效果设置。声音默认关闭，玩家主动开启。

## Considered worlds
七个候选：夜间植物图鉴、温室花房、花园沙盘、植物木刻、微距摄影、月下生态缸、剪纸影戏。种子分配第六个。仪表桥（declined：借鉴状态响应一致）、数据场（declined：保留种子可复现）、胶片（declined：坚持单一场景连续性）、溯源带（declined：记录完整）、拳赛海报（declined：主次明确）、图卡夜（competitive：升级卡易理解，但全盘图卡弱化移动体验）。仅吸收纪律，不拼贴装饰。

## Build path
code-led；实时程序化游戏画面与 DOM 控件直接实现。没有生成或承诺不存在的视觉稿。
