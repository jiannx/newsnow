import { sources } from "./sources"
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "./type.util"
import { updatedSourceIds as _updatedSourceIds } from "./updated-sources"
import type { ColumnID, HiddenColumnID, Metadata, SourceID } from "./types"

export const columns = {
  china: {
    zh: "国内",
  },
  world: {
    zh: "国际",
  },
  tech: {
    zh: "科技",
  },
  finance: {
    zh: "财经",
  },
  sports: {
    zh: "体育",
  },
  curated: {
    zh: "自选",
  },
  focus: {
    zh: "关注",
  },
  realtime: {
    zh: "实时",
  },
  hottest: {
    zh: "最热",
  },
  updated: {
    zh: "更新",
  },
} as const

const updatedSourceIds = [..._updatedSourceIds] as SourceID[]
const defaultHottestExcludedSourceIds = ["bilibili-hot-video", "bilibili-ranking"] as const satisfies SourceID[]
const curatedSourceIds = [
  "aihot",
  "v2ex-share",
  "hackernews",
  "producthunt",
  "github-trending-today",
  "indiehackers",
  "reddit",
  "sspai",
  "juejin",
  "tencent-hot",
  "thepaper",
  "toutiao",
  "zhihu",
  "zaobao",
  "kaopu",
  "wallstreetcn-quick",
  "cls-telegraph",
  "xueqiu-hotstock",
  "jin10",
] as const satisfies readonly SourceID[]

export const fixedColumnIds = ["curated", "focus", "hottest", "realtime", "updated"] as const satisfies Partial<ColumnID>[]
export const hiddenColumns = Object.keys(columns).filter(id => !fixedColumnIds.includes(id as any)) as HiddenColumnID[]

function getSortedSourceIds(type: "hottest" | "realtime") {
  return typeSafeObjectEntries(sources)
    .filter(([, v]) => v.type === type && !v.redirect)
    .map(([k]) => k)
    .filter(id => type !== "hottest" || !(defaultHottestExcludedSourceIds as readonly SourceID[]).includes(id))
    .sort((m, n) => m.localeCompare(n))
}

export const metadata: Metadata = typeSafeObjectFromEntries(typeSafeObjectEntries(columns).map(([k, v]) => {
  switch (k) {
    case "curated":
      return [k, {
        name: v.zh,
        sources: [...curatedSourceIds],
      }]
    case "focus":
      return [k, {
        name: v.zh,
        sources: [] as SourceID[],
      }]
    case "hottest":
      return [k, {
        name: v.zh,
        sources: getSortedSourceIds("hottest"),
      }]
    case "realtime":
      return [k, {
        name: v.zh,
        sources: getSortedSourceIds("realtime"),
      }]
    case "updated":
      return [k, {
        name: v.zh,
        sources: updatedSourceIds.filter(id => sources[id] && !sources[id].redirect),
      }]
    default:
      return [k, {
        name: v.zh,
        sources: typeSafeObjectEntries(sources).filter(([, v]) => v.column === k && !v.redirect).map(([k]) => k),
      }]
  }
}))
