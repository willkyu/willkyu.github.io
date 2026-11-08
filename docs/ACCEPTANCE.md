# 本地验收记录

验收日期：2026-11-05。测试对象为本地生产构建，不是设计稿。

## 自动检查

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | 通过 |
| 配置单元测试 | `npm test` | 2 项通过 |
| 生产构建 | `npm run build` | 通过，输出 `dist/` |
| 浏览器交互与布局 | `npm run test:e2e` | Edge，参考尺寸基线、桌面/平板/手机/reduced-motion |

浏览器测试覆盖：放大后的母版几何尺寸、一次点击分批生成整类内容、内容耗尽禁用、popup 入场、持续物理排布、悬浮时整卡与文字同比缩放且标题断行不变、展开正文不低于 14px 且不依赖 DotGothic16、空白拖动不改变固定画布、手机顶部导航与下方 popup 边界、卡片/外链的整卡和内部层级视差、中心选项保持平面、唱片底板与中心图案对齐，以及 reduced-motion 下仍可导航和打开内容。

## 实际视口与截图

- 1440 × 900 初始页：`.artifacts/screenshots/portal-desktop-initial.png`
- 1440 × 900 四窗口：`.artifacts/screenshots/portal-desktop-multi-window.png`
- 1024 × 768 多窗口：`.artifacts/screenshots/portal-tablet-multi-window.png`
- 390 × 844 手机展开：`.artifacts/screenshots/portal-mobile-expanded.png`

截图由 Playwright 打开 `vite preview` 后直接获取。参考站相同尺寸截图位于 `.artifacts/reference/`，只用于本地对照。

## 视觉核对

已还原：332 × 240 中心人物对象、人物破框、44px 压叠标题、白描边气泡、原比例胶囊菜单、由中心向外围增大的点阵、纯黑白块面、原站五类卡片尺度以及悬停/进入/退出反馈。

当前交互：固定画布、桌面中心附近随机 popup、手机顶部导航下方 popup、排斥/吸引重排、整类延时生成、保持文字断行并带物理挤压的悬停缩放、所有 Item 与中心选项的对称 3D 视差、人物遮挡气泡、静态点阵，以及桌面/平板/手机响应式布局。

仍有差异：栏目和文字使用门户内容而不是原站文字；人物与卡片封面仍是临时参考素材；Canvas 2D 重现原 WebGL 点阵算法，边缘抗锯齿会有轻微实现差异。

## 配置操作核对

无需改组件即可新增第五栏目、替换推荐内容、调整槽位、替换人物路径、切换单图/分层、修改网点、菜单文字/字体和所有公开动效参数。单元测试已覆盖第五栏目与错误引用；运行时错误页提供中文字段提示。
