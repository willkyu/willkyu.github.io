# `_homepage.md` 带注释模板

> 说明文件，不会被主页读取。Blog 实际文件是 `source/_homepage.md`，Research 实际文件是 `content/_homepage.md`。复制条目时可以删除下面的 HTML 注释。

<!-- 清单版本必须保留为 1；整个文件只需要一个 front matter。 -->
---
homepageManifest: 1
---

<!--
二级标题必须是带显示别名的 Obsidian Wiki Link：
- Blog 指向 source/_posts/ 下的真实文章。
- Research 指向 content/ 下的真实 Quartz 文档。
- 竖线右侧是主页卡片标题。
-->
## [[文档/相对路径|主页显示标题]]

<!-- 绑定主页中心栏目：research / blog / pokemon / projects。 -->
bind:: research

<!-- 卡片造型：text / essay / gallery / book / browser / disc。essay 会在悬浮或聚焦时向下展开。 -->
appearance:: text

<!-- 主页卡片摘要；必填、单行，不要使用换行或 Markdown 块。 -->
summary:: 用一句话说明这篇内容，建议控制在 20–60 个汉字。

<!-- 标签可选，使用英文逗号或中文逗号分隔。 -->
tags:: 研究, 示例

<!-- 排序整数；数字越小越靠前，建议使用 10、20、30，方便中间插入。 -->
order:: 10

<!-- 可选，默认为 true；false 会保留配置但不输出到 JSON。 -->
enabled:: true

<!--
cover 对 gallery / book / browser / disc 必填，对 text 可省略：
- 必须指向当前 Vault 中真实存在且会公开构建的附件。
- Blog 构建后输出 /blog/ 开头的 URL。
- Research 构建后输出 /research/ 开头的 URL。
-->
cover:: [[附件/example-cover.webp]]

<!--
不要填写 id、href、坐标、尺寸、视差或动画：
- id 由主页根据 source + 最终 href 自动生成。
- href 由 Blog/Research 的实际 permalink 或 slug 生成。
- 位置和动效由主页统一控制。
-->
