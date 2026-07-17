import { describe, expect, it } from "vitest"
import { fixedColumnIds, metadata } from "./metadata"

describe("curated column", () => {
  it("keeps the configured sources in display order", () => {
    expect(fixedColumnIds).toContain("curated")
    expect(metadata.curated.sources).toEqual([
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
    ])
  })
})
