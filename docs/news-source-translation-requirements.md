# 新闻源与翻译能力需求清单

## 背景

当前 fork 版本希望在 NewsNow 上增强英文创业、产品、技术类信息流，并让英文内容对中文读者更友好。

NewsNow 当前的内容获取模式是按需请求：前端访问某个 source 时调用 `/api/s?id=...`，后端先读缓存；缓存不可用或允许刷新时才执行对应抓取器。新需求应保留这种模式，不引入默认后台全量定时爬取。

## 目标

1. 支持调整默认显示面板的顺序。
2. 新增 Indie Hackers 内容源。
3. 英文标题和描述同时显示中文翻译。
4. Product Hunt、GitHub Trending 等来源可直接显示项目描述和相关信息。
5. 使用 DeepSeek 作为第一版翻译服务，并通过缓存控制成本。

## 非目标

1. 第一版不做全站静态 UI 文案的完整多语言系统。
2. 第一版不翻译中文来源。
3. 第一版不抓取文章全文，也不深入抓取每个项目官网。
4. 第一版不新增后台 cron 全量爬取任务，除非后续明确需要。

## 功能需求

### 1. 默认面板顺序调整

默认展示的 source 面板应支持显式排序，而不是完全依赖 source id 字母序。

期望行为：

- 默认 `hottest` 页面优先按照配置顺序展示。
- 未出现在配置列表里的 source 仍然继续展示，排在配置项之后。
- 用户自定义的 `focus` 关注列行为保持不变。

建议第一版顺序：

1. `producthunt`
2. `github-trending-today`
3. `hackernews`
4. `indiehackers`

涉及文件：

- `shared/metadata.ts`
- `shared/pre-sources.ts`

验收标准：

- 打开默认最热页时，配置过的 source 按指定顺序排在前面。
- 未配置排序的现有 source 仍正常显示。
- 不破坏已有 source id 和 redirect 行为。

### 2. 新增 Indie Hackers 来源

新增 `https://www.indiehackers.com/` 作为内容源。

期望行为：

- 来源出现在科技/创业相关栏目中。
- 抓取 Indie Hackers 的最新或热门帖子。
- 每条内容至少包含：
  - `id`
  - `title`
  - `url`
  - 描述或摘要，如果页面可获取
  - 评论数、点赞数等轻量元信息，如果页面可获取

建议 source 配置：

- id: `indiehackers`
- name: `Indie Hackers`
- column: `tech`
- type: `hottest` 或 `realtime`，取决于最终选用页面
- interval: 10 到 30 分钟
- home: `https://www.indiehackers.com/`

涉及文件：

- `shared/pre-sources.ts`
- `server/sources/indiehackers.ts`

验收标准：

- `/api/s?id=indiehackers` 返回有效 `NewsItem[]`。
- 前端可以正常展示该 source；如果没有专属 icon，使用现有 fallback。
- 如果 Indie Hackers 页面结构变化或请求失败，后端应回退旧缓存，不影响其他来源。

### 3. 英文内容中英双语显示

英文来源的标题和描述应同时展示中文翻译。

期望行为：

- 英文 source 保留英文原文。
- 中文翻译直接显示在列表项中，不只放在 hover。
- 描述/tagline 有翻译时也显示中文。
- 中文来源不做翻译。
- 翻译缺失或失败时，仍展示原始英文内容。

建议展示形式：

- 第一行：英文标题
- 第二行：中文标题，如果存在
- 第三行：英文描述和/或中文描述，按可用空间截断

建议数据结构：

```ts
interface NewsItem {
  id: string | number
  title: string
  url: string
  mobileUrl?: string
  pubDate?: number | string
  translation?: {
    title?: string
    description?: string
  }
  extra?: {
    hover?: string
    date?: number | string
    info?: false | string
    diff?: number
    icon?: false | string | {
      url: string
      scale: number
    }
  }
}
```

涉及文件：

- `shared/types.ts`
- `src/components/column/card.tsx`
- 可新增 `server/utils` 或 `server/services` 下的翻译工具

验收标准：

- Product Hunt、GitHub Trending、Indie Hackers 可以显示中文翻译。
- 没有翻译字段的旧 source 仍按原逻辑渲染。
- 移动端和桌面端不出现明显文字重叠或布局撑破。

### 4. Product Hunt 和 GitHub 显示描述信息

Product Hunt 和 GitHub Trending 当前已经抓到部分描述信息，但主要放在 hover 中，正文不可见。

当前行为：

- Product Hunt 将 `tagline` 放在 `extra.hover`。
- GitHub Trending 将 repo 描述放在 `extra.hover`。
- 用户不 hover 时看不到这些描述。

期望行为：

- Product Hunt 展示：
  - 产品名
  - tagline/description
  - votes 数
  - 标题和 tagline 的中文翻译
- GitHub Trending 展示：
  - repo 名称
  - repo 描述
  - stars 数
  - 描述的中文翻译

涉及文件：

- `server/sources/producthunt.ts`
- `server/sources/github.ts`
- `src/components/column/card.tsx`

验收标准：

- 描述信息无需 hover 即可看到。
- votes、stars 等元信息继续显示。
- hover 可保留作为辅助能力。

### 5. DeepSeek 翻译服务

第一版使用 DeepSeek 作为默认翻译服务。

推荐模型：

- `deepseek-v4-flash`

建议环境变量：

```env
TRANSLATE_PROVIDER=deepseek
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
TRANSLATE_TARGET=zh-Hans
TRANSLATE_BATCH_SIZE=30
```

期望行为：

- 只翻译英文文本。
- 标题和描述一起翻译，减少 prompt 开销。
- 尽量批量翻译多个 item。
- 模型输出严格 JSON。
- 翻译失败时保留原文，不让 source 抓取整体失败。

建议翻译约束：

- 保留产品名、repo 名、公司名、框架名、技术名等专有名词。
- 翻译为简洁自然的简体中文。
- 不添加额外解释。
- 不修改 URL、票数、星标数等元数据。

验收标准：

- 未配置 `DEEPSEEK_API_KEY` 时，翻译能力自动关闭，内容抓取不受影响。
- DeepSeek 请求失败时，source 仍返回原始内容。
- 翻译结果可以稳定解析并安全渲染。

## 缓存需求

翻译结果必须缓存，避免重复调用 DeepSeek。

建议缓存 key：

```text
translation:${provider}:${target}:${sourceId}:${itemId}:${textHash}
```

期望行为：

- 同一条标题/描述只翻译一次。
- 服务器重启后缓存仍保留，前提是数据库目录已持久化。
- 当标题或描述变化时，`textHash` 变化，自然触发重新翻译。

实现选项：

1. 新增 `translation_cache` 表。
2. 复用现有 `cache` 表，使用 namespaced key。

推荐方案：

- 新增 `translation_cache` 表，边界更清晰，也方便后续清理。

验收标准：

- 同一 source 重复刷新不会重复调用 DeepSeek。
- 翻译缓存表能随现有数据库初始化流程创建。
- `ENABLE_CACHE=true` 时翻译缓存正常生效。

## 成本预估

按 Product Hunt、GitHub Trending、Indie Hackers 三类来源估算：

- 每天约 100 条内容。
- 每月约 3,000 条内容。
- 每条翻译标题和一句短描述。

使用 `deepseek-v4-flash` 且开启缓存后，月成本通常应低于 10 元人民币。更典型的范围约为 1 到 3 元/月。

## 待确认问题

1. Indie Hackers 第一版抓最新帖子、热门帖子，还是拆成两个子 source？
2. 默认首页继续使用 `hottest`，还是新增一个产品/创业专用栏目？
3. 翻译后的描述是否默认全部显示，还是最多显示两行？
4. 翻译第一版只覆盖 Product Hunt、GitHub Trending、Indie Hackers，还是同时覆盖 Hacker News、Steam 等英文来源？

## 建议实施顺序

1. 先让 Product Hunt 和 GitHub 的描述在前端可见。
2. 增加默认 source 显式排序。
3. 新增 Indie Hackers source，先不接翻译。
4. 增加 `NewsItem.translation` 数据结构和 UI 渲染。
5. 增加 DeepSeek 翻译 provider 和翻译缓存。
6. 对 Product Hunt、GitHub Trending、Indie Hackers 启用翻译。
