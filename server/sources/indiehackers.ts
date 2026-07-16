import * as cheerio from "cheerio"
import type { NewsItem } from "@shared/types"

const baseURL = "https://www.indiehackers.com"

export default defineSource(async () => {
  const html: any = await myFetch(baseURL)
  const $ = cheerio.load(html)
  const news: NewsItem[] = []
  const seen = new Set<string>()

  $(".homepage-post").each((_, el) => {
    const $el = $(el)
    const $link = $el.find(".story__text-link, .entry__product-name").first()
    const href = $link.attr("href")
    const title = ($el.find(".story__title").first().text() || $el.find(".entry__product-name").first().text()).replace(/\s+/g, " ").trim()

    if (!href || !title) return

    const url = new URL(href, baseURL).toString()
    if (seen.has(url)) return
    seen.add(url)

    const description = $el.find(".entry__product-tagline").first().text().replace(/\s+/g, " ").trim()
    const likes = $el.find(".story__count--likes .story__count-number").first().text().replace(/\s+/g, "").trim()
    const comments = $el.find(".story__count--comments .story__count-number").first().text().replace(/\s+/g, "").trim()
    const info = [
      likes && `up ${likes}`,
      comments && `cm ${comments}`,
    ].filter(Boolean).join(" / ")

    news.push({
      id: url,
      title,
      url,
      description: description || undefined,
      extra: {
        info: info || false,
        hover: description || undefined,
      },
    })
  })

  if (!news.length) throw new Error("Cannot fetch Indie Hackers data")
  return news
})
