export default defineSource(async () => {
  const data = await rss2json("https://www.reddit.com/r/popular/.rss?limit=30", {
    "User-Agent": "NewsNow/1.0 (+https://45.32.126.35)",
  })
  if (!data?.items.length) throw new Error("Cannot fetch Reddit feed")

  return data.items.map(item => ({
    id: item.link,
    title: item.title,
    url: item.link,
    pubDate: item.created,
  }))
})
