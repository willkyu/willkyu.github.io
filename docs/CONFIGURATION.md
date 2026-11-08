# 配置说明

运行时只读取 `public/portal.config.json`。修改后刷新开发页面即可生效；不需要改 React 组件。配置版本当前为 `1`。

`portal.config.json` 是严格 JSON，不能写 `//` 或 `/* */` 注释。逐字段中文注释和可复制示例位于 `docs/portal.config.annotated.jsonc`；编辑时参考该文件，把需要的值复制到正式 JSON。素材分辨率、比例、格式和替换步骤见 `docs/ASSETS.md`。

## 顶层字段

| 字段 | 用途 |
| --- | --- |
| `configVersion` | 配置格式版本，当前必须为 `1` |
| `site` | 站点名、标题、简介、气泡与顶部链接 |
| `character` | 单图/分层人物、位置、缩放与视线跟随 |
| `categories` | 栏目顺序、显示状态、选择规则、槽位与“查看全部”地址 |
| `contentSources` | 运行时精选内容 feed；内容发布后无需重新构建主页 |
| `content` | 稳定 ID、栏目引用、标题、封面、标签、造型与链接 |
| `theme` | 颜色、字体、线宽、阴影、圆角和网点 |
| `layout` | 交互模式、参考画布、断点与固定槽位 |
| `motion` | 动画开关、时长、缓动、缩放、倾角、按压与入场距离 |

## 人物

- `mode`: `single` 或 `layered`。
- `singleImage`: 单图模式使用的透明图片。
- `layers`: 分层模式数组。`kind` 可为 `base`、`eye`、`foreground`；`zIndex` 控制次序；眼睛层可设置 `followPointer`。
- `scale`、`x`、`y`: 整体缩放与像素偏移。
- `anchor`: 决定素材的 `object-position` 与缩放原点。
- `crop`: `contain` 或 `cover`。
- `eyeFollow`: 是否开启及最大水平/垂直像素位移。缺图层时会自动隐藏失败层；基础层失败会显示占位符。

## 栏目与内容选择

`contentSources` 用于读取独立站点发布的精选内容。目前配置为：

```json
[
  { "source": "blog", "url": "/blog/homepage-feed.json", "hrefPrefix": "/blog/" },
  { "source": "research", "url": "/research/homepage-feed.json", "hrefPrefix": "/research/" }
]
```

页面先读取本地配置并立即显示中心场景，再在后台并行读取所有 feed；不会为了远端内容显示独立 Loading 页面，也不会在 feed 到达后重置已经出现的场景。主页验证 `schemaVersion`、`source`、`bind`、链接前缀、卡片样式、封面和字段类型，然后替换内容项。feed 条目不含手写 `id`；主页以 `source + href` 派生内部 ID，并将 `bind` 映射为栏目。固定入口继续保留；成功读取远端内容时，本地 `example: true` 内容会被运行时结果替换。某个 feed 断网、返回非 2xx、超时或格式无效时，对应栏目会生成一张可点击的 `FEED 404` 卡片，链接到该站点根路径；与失败来源无关的本地兴趣示例仍保留，其他成功来源也正常显示。Vite 开发服务器会使用 IPv4 HTTPS 连接将这两个路径代理到 `https://willkyu.github.io`，因此 `npm run dev` 可以直接查看线上 feed 的当前效果。

每条远端内容的 `appearance`、标题、摘要、标签和封面直接来自 feed；位置、缩放、视差和 popup 动画仍由主页控制。内容链接不需要在 `_homepage.md` 中另设字段：条目标题里的 Obsidian Wiki Link 会由对应站点解析为 feed 的 `href`，主页把整张卡片作为链接。

Blog 与 Research 可共同参考 `docs/homepage-manifest.annotated.md` 中的逐字段注释模板；两边仓库各自的构建文档仍是最终规则来源。

栏目字段 `selection` 可为：

- `ordered`: 按内容 `order` 选取尚未显示的第一条。
- `random`: 从该栏目尚未显示的内容中随机选取。

`layout.mode: "reference-physics"` 下，单击栏目会把该栏目全部未生成内容加入队列，以 170ms 间隔在人物附近的随机位置 popup 出现。候选方向会先按视口边界、人物尺寸和卡片尺寸排除无法容纳的方向，再结合已有对象间距评分；因此竖屏手机通常只会在上下空间生成。每个新对象随后加入排斥/吸引计算，会推动周围对象并重新收紧布局；悬浮缩放同样会更新物理尺寸并挤压邻居。内容只生成一次，点击后栏目按钮立即禁用。

触摸设备不依赖浏览器模拟的 `:hover`：第一次点按内容 item 会展开摘要、画廊或唱片动效，第二次点按才访问链接，点按页面空白处会收起。触屏放大倍率单独限制：手机最高约 `1.18`，平板最高约 `1.32`，桌面端仍使用 `motion.hoverScale`。中心人物与三个入口 block 在触屏端只使用 `DeviceOrientationEvent` 的设备方向数据驱动视差；iOS 会在第一次点按时请求授权，未授权、无传感器或没有收到方向数据时，视差固定归中。

`layout.mode: "fixed-slots"` 下，`selection` 才决定顺序或随机选择：先使用 `slots` 数组中的空槽位；没有空槽位时在原槽位切换，不影响其他槽位。同一内容 ID 不会同时出现两次。

`viewAllHref` 已保留在配置模型中，内容窗口的目标链接由每条 `content.href` 决定。固定入口应继续使用 `/blog/` 与 `/research/`。

卡片 `appearance` 的可用值与 `cover` 必填规则统一发布在 `public/homepage-item-types.json`。主页运行时校验也直接读取该文件，Blog 与 Research 不应再维护独立的硬编码列表。它只决定外观，不限制内容属于哪个栏目。

其他仓库应在生成 feed 前读取下面的稳定地址：

```text
https://raw.githubusercontent.com/willkyu/willkyu.github.io/main/public/homepage-item-types.json
```

检查时在 `itemTypes` 中查找目标 `appearance`；找不到就终止构建。如果对应条目的 `coverRequired` 为 `true`，还必须检查 `_homepage.md` 条目包含有效 `cover`。同时应使用 `feedSchemaVersion` 写入最终 `homepage-feed.json` 的 `schemaVersion`。`fieldRules.summary` 说明了摘要可用 `\n` 分段；推荐在发布时从链接对应的 Markdown 正文自动提取，而不是由主页运行时抓取每个链接。

- `essay` 默认显示标题条，悬浮或键盘聚焦后保持顶部位置不变并向下展开摘要；展开高度按文字长度和强制换行计算，每段自动首行缩进，整体仍参与物理碰撞。
- `gallery` 会把同一张 `cover` 分别裁切为后、中、前三张画框，以固定层级、缩放、明暗和不同幅度的二维位移形成伪 3D 景深；不使用 CSS 透视或 Z 轴。白框在前景画面位移之上叠加反向的远景位移，文字展签使用近景与中景位移之和，因此二者不会同步移动；悬浮时画框展开并显示摘要。

## 交互模式与槽位

- `layout.mode: "reference-physics"`：当前默认母版。画布固定不可拖动；内容在中心附近 popup 入场后参与物理排布，并根据桌面、平板和手机可视区域缩放与约束位置。
- `layout.mode: "fixed-slots"`：保留的后续个性化模式，启用下面的响应式槽位、关闭和重新打开规则。

每个槽位必须在 `desktop`、`tablet`、`mobile` 三个断点提供：

- `x`、`y`: 相对于场景宽高的百分比位置。
- `width`、`height`: 像素尺寸；CSS 会限制宽度不超过当前视口。
- `maxContentHeight`: 窗口正文最大高度，正文可独立滚动。
- `anchor`: `top-left`、`center`、`top-right`、`bottom-left`、`bottom-right`。
- 槽位级 `zIndex`、`angle`、`enterFrom`: 基础层级、确定性倾角和入场方向。

修改槽位不会改变动画 transform。手机下四个槽位可配置为同一区域，界面只展示当前激活窗口，顶部小标签切换仍打开的窗口。

## 主题和动效

- `halftone.enabled`、`density`、`intensity`、`fadeRadius` 控制网点开关、间距、透明度和中心留白范围。
- `fontDisplay`、`fontBody` 接受完整 CSS 字体栈，务必保留中文字体回退。
- 当前默认不加载网络字体：展示文字使用 `Segoe Print / KaiTi / STKaiti` 本机手写字体栈，正文使用 `Microsoft YaHei UI / PingFang SC` 系统黑体栈。
- `lineWidth`、`shadowOffset`、`radius` 控制漫画框体。
- `motion.enabled` 为总开关；`duration` 和 `fastDuration` 单位毫秒，主要用于固定槽位模式。
- 默认模式中的普通 Item 通过实际宽高插值放大，字体使用带最小值的容器相对尺寸同步增长，以维持换行比例并避免整卡位图缩放造成模糊；`text` 外观会先根据中英文标题宽度和预计行数计算基础宽高，长标题不再塞入固定尺寸，悬浮时再同时扩宽和纵向展开到至少 14px 的正文状态。两者都会同步更新物理碰撞尺寸。
- 卡片视差使用内部远/中/近景的整数像素位移；封面背景反向轻移，标题位于中层，底部白色说明条使用更强的近景位移。响应式比例直接计入对象实际宽高，不再对排版完成的整张卡片做长期缩放或零角度 3D 合成。整个视口的指针位置驱动中心黑底、标题、人物和栏目选项分层移动，中心外框始终固定；指针离开页面或窗口失焦时自动归中。
- `hoverScale` 在母版模式控制内容和外链悬停目标缩放，默认 `1.6`；其余倾斜、按压和入场字段用于固定槽位模式。
- 系统 `prefers-reduced-motion: reduce` 会覆盖配置，将动画缩到近乎即时，但不隐藏内容。

## 校验与错误提示

页面启动时会检查：配置版本、重复栏目/内容/槽位 ID、无效槽位引用、错误栏目引用、非法卡片或选择枚举、缺失断点、无效锚点、过大的槽位角度、网点/动效范围等。错误会以 `CONFIG ERROR` 页面列出具体字段，不会静默显示半成品。

`portal.config.schema.json` 为编辑器提供 JSON Schema；TypeScript 类型位于 `src/config/types.ts`，运行时校验位于 `src/config/validate.ts`。`portal.config.minimal.json` 是最小可改示例，`docs/portal.config.annotated.jsonc` 是带逐项注释的完整说明模板。

## 常见配置操作

- 新增第五栏目：增加一条 `categories`，关联已有或新增槽位，再增加对应 `content`；组件无需修改。
- 替换推荐内容：保持稳定 ID 或新增 ID，修改标题、造型、链接和 `order`。
- 调整窗口：只改目标槽位三个断点的位置和尺寸。
- 换人物：按 `ASSETS.md` 放入文件并改 `character`。
- 改网点、菜单文字/字体、动效：分别修改 `theme.halftone`、栏目 `label`/`theme.font*`、`motion`。
