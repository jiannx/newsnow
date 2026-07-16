import type { NewsItem } from "@shared/types"

interface HackerNewsItem {
  id: number
  title?: string
  score?: number
  descendants?: number
  deleted?: boolean
  dead?: boolean
}

export default defineSource(async () => {
  const baseURL = "https://news.ycombinator.com"
  const apiBaseURL = "https://hacker-news.firebaseio.com/v0"
  const ids: number[] = await myFetch(`${apiBaseURL}/topstories.json`, {
    timeout: 15000,
    retry: 1,
  })
  const itemResults = await Promise.allSettled(ids.slice(0, 30).map(id => myFetch<HackerNewsItem>(`${apiBaseURL}/item/${id}.json`, {
    timeout: 15000,
    retry: 1,
  })))
  const items = itemResults.flatMap(result => result.status === "fulfilled" ? [result.value] : [])

  return items
    .filter(item => item?.id && item.title && !item.deleted && !item.dead)
    .map((item): NewsItem => ({
      id: item.id,
      title: item.title!,
      url: `${baseURL}/item?id=${item.id}`,
      extra: {
        info: [
          item.score !== undefined && `${item.score} points`,
          item.descendants !== undefined && `${item.descendants} comments`,
        ].filter(Boolean).join(" / "),
      },
    }))
})
