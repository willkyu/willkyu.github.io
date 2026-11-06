# 图像素材规格与替换

主页会按最终 CSS 尺寸直接排版，不再把整张卡片作为位图二次放大。素材仍建议至少准备显示尺寸的 2 倍，以便在高分屏上保持清晰；照片和漫画线稿不要预先模糊，也不要用最近邻放大。

## 推荐规格

| 用途 | 页面大致显示尺寸（桌面） | 最低建议 | 推荐导出 | 比例与构图 |
| --- | ---: | ---: | ---: | --- |
| 人物单图或每个人物图层 | 约 219 × 259 px | 438 × 518 px | 876 × 1036 px | 透明竖图；所有分层必须使用完全相同的画布 |
| `browser` 封面 | 约 259 × 162 px | 520 × 325 px | 800 × 500 px | 约 16:10；文字和主体放在中部 80% |
| `book` 封面 | 约 197 × 278 px | 400 × 560 px | 600 × 840 px | 约 5:7；底部会叠加说明条 |
| `disc` 中心图 | 约 167 × 167 px | 320 × 320 px | 512 × 512 px | 必须为正方形；重要内容放在中央圆形安全区 |
| `gallery` 封面 | 约 250 × 190 px | 520 × 325 px | 960 × 600 px | 约 16:10；同图会以不同焦点裁切到三张伪 3D 画框，四边预留约 12% |
| SVG 线稿、图标、几何封面 | 自适应 | — | 使用正确 `viewBox` | 不要写死背景色，优先黑白矢量 |

以上是当前默认母版的桌面尺寸。手机端会按真实布局尺寸重新排版；使用 2× 或更高素材即可覆盖常见设备像素比。

## 格式和体积

- 透明人物、眼睛和前景层：优先 PNG 或无损 WebP。
- 照片、房间、网页截图：优先 WebP；也可使用质量 82–90 的 JPEG。
- 黑白几何图、占位封面和图标：优先 SVG。
- 色彩空间使用 sRGB；不要嵌入 CMYK 配置。
- 普通封面建议控制在 300 KB 内，人物全套建议控制在 1 MB 内，单张文件尽量不要超过 800 KB。
- 不要在素材里烘焙网点、网页背景、模糊、圆角或阴影；这些由主页 CSS 统一生成。

## 人物单图模式

1. 把透明图片放到 `public/assets/character/character.png`。
2. 在 `public/portal.config.json` 中把 `character.mode` 改为 `single`。
3. 把 `character.singleImage` 改为 `/assets/character/character.png`。
4. 用 `scale`、`x`、`y` 微调人物大小和位置；无需删除 `layers`，单图模式会忽略它们。

人物主体建议偏左，右侧为气泡和四个栏目选项预留空间。人物可以越过黑色框体，但不要让头部或手部贴住透明画布边缘。

## 人物分层模式

所有图层必须满足以下条件：

- 像素宽高完全相同。
- 原点、人物位置和透明边距完全相同。
- 导出时关闭“裁切到可见内容”或“Trim transparent pixels”。
- 眼睛层只保留需要移动的眼睛像素，其余区域透明。
- 前景层用于需要覆盖人物或其他人物层的发丝、手臂等部分。

推荐目录：

```text
public/assets/character/
  character-base.png
  character-eye-left.png
  character-eye-right.png
  character-foreground.png
```

配置示例：

```json
{
  "mode": "layered",
  "layers": [
    { "id": "base", "src": "/assets/character/character-base.png", "zIndex": 1, "kind": "base" },
    { "id": "left-eye", "src": "/assets/character/character-eye-left.png", "zIndex": 2, "kind": "eye", "followPointer": true },
    { "id": "right-eye", "src": "/assets/character/character-eye-right.png", "zIndex": 3, "kind": "eye", "followPointer": true },
    { "id": "front", "src": "/assets/character/character-foreground.png", "zIndex": 4, "kind": "foreground" }
  ]
}
```

## 内容封面路径

- 本地素材放在 `public/assets/` 下，配置中使用从 `/assets/` 开始的根路径，例如 `/assets/covers/project.webp`。
- Blog 或 Research feed 中的 `cover` 必须位于该来源的 `hrefPrefix` 下，例如 `/blog/images/post.webp` 或 `/research/assets/paper.webp`。
- `text`、`essay` 外观不需要 `cover`；`browser`、`book`、`disc`、`gallery` 必须提供 `cover`。
- 封面在卡片中属于装饰图层，标题和摘要仍应由文本字段提供，不要只把标题画进图片。

## 当前人物素材

主页当前使用 `public/assets/character/` 中的 37 分层素材：人物底图、左右眼和 `37-cover-v2.png` 前景遮挡层。遮挡层沿原始 `37cover` 边缘向外补充 2px，新增像素逐点来自 `37.png`，没有缩放或重绘。四张图片均为 384 × 470 px 的同画布透明 PNG；原始文件仍保留在 `public/assets/temporary/`，便于回溯。

其他 `temporary` 封面仍只用于开发期构图和交互验证，公开发布前应替换。
