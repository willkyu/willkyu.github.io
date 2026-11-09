# Will Kyu 漫画个人门户

一个可纯静态部署的 React + TypeScript + Vite 个人门户。首屏先 popup 中心人物与导航，再依次 popup 三个外链入口和底部参考站致谢条；不显示独立 Loading 页面。页面同时在后台读取 Blog 与 Research 各自发布的 `homepage-feed.json`，因此两边更新精选内容时无需重新构建主页；远端失败会在对应栏目生成可点击的 `FEED 404` 卡片。当前默认使用 `reference-physics` 母版模式：画布固定，桌面内容先在中心对象外的第一圈 popup，再由物理碰撞自然推出；手机端初始保留完整中心人物卡，点击任一栏目后连续移动、收缩并淡变为顶部三按钮导航，内容 popup 在停靠动画后半段接入。三个外链 block 与内容会扫描导航下方的整个可用区域，优先选择净空最大的候选位置；随后以稳定方向施加成对碰撞冲量，并通过阻尼逐渐停下，既不会因相反作用力抵消而粘住，也不会逐帧瞬移。单击分类会以短间隔生成该分类全部内容；悬浮放大使用保持断行的整体矢量缩放，同时扩大碰撞盒并推动邻居。桌面物理与指针状态按约 30Hz 合并更新，由 CSS 补间保持动画流畅，避免每个高频指针事件都重绘完整场景。外链、致谢条和所有卡片使用远/中/近景的整数像素分层视差，中心选项作为人物之上的近景层跟随指针，并保留响应式点阵背景。此前实现的确定槽位模式保留为 `fixed-slots`。

## 本地运行

```bash
npm install
npm run dev
```

生产检查与预览：

```bash
npm run typecheck
npm test
npm run build
npm run preview
npm run test:e2e
```

Vite 开发地址通常为 `http://localhost:5173/`，生产预览为 `http://localhost:4173/`。`npm run dev` 会把两个同域 feed 路径代理到 `willkyu.github.io`，所以本地开发也会显示 Blog 与 Research 当前发布的真实精选内容；断网、返回 404 或 feed 格式无效时，对应栏目会生成一张可点击的 `FEED 404` 卡片。构建产物位于 `dist/`，不需要服务器运行时。

## 主要入口

- 主配置：[`public/portal.config.json`](public/portal.config.json)
- 配置 Schema：[`public/portal.config.schema.json`](public/portal.config.schema.json)
- 最小配置：[`public/portal.config.minimal.json`](public/portal.config.minimal.json)
- 配置说明：[`docs/CONFIGURATION.md`](docs/CONFIGURATION.md)
- 带逐项注释的配置模板：[`docs/portal.config.annotated.jsonc`](docs/portal.config.annotated.jsonc)
- `_homepage.md` 带注释模板：[`docs/homepage-manifest.annotated.md`](docs/homepage-manifest.annotated.md)
- Feed item 类型契约：[`public/homepage-item-types.json`](public/homepage-item-types.json)
- 漫画素材说明：[`docs/ASSETS.md`](docs/ASSETS.md)
- 参考拆解与差异：[`docs/REFERENCE.md`](docs/REFERENCE.md)
- 验收记录：[`docs/ACCEPTANCE.md`](docs/ACCEPTANCE.md)
- 发布前清单：[`docs/PRE_RELEASE.md`](docs/PRE_RELEASE.md)

## 工程结构

```text
src/
  components/       响应式随机场景、人物、菜单、固定窗口、五类卡片
  config/           TypeScript 类型、运行时校验、单元测试
  App.tsx           配置入口与固定槽位备用模式
  styles.css        漫画主题、响应式布局、动效
public/
  assets/           临时人物素材和示例封面
  homepage-item-types.json  Blog/Research 共用的 item 类型契约
  portal.config.*   主配置、最小配置和 JSON Schema
tests/              Playwright 交互、布局与截图验收
docs/               配置、素材、参考、验收和发布说明
```

## 部署约定

门户固定发布在仓库根路径，`vite.config.ts` 的 `base` 为 `/`。`/blog/` 与 `/research/` 是同域独立站点；主页只在浏览器中读取它们的公开 feed，不生成或修改其内容。

本次未推送、未注册托管服务、未触发 GitHub Pages。准备正式发布时，可以把 [`.github/workflows/pages.yml.example`](.github/workflows/pages.yml.example) 重命名为 `pages.yml`，在 GitHub 仓库的 Pages 设置中选择 “GitHub Actions”，再推送到 `main`。该工作流只上传 `dist/`。
