import process from "node:process"
import type { NewsItem, SourceID } from "@shared/types"
import { getTranslationCacheTable } from "#/database/translation-cache"

interface TranslationResult {
  title?: string
  description?: string
}

interface TranslationTask {
  key: string
  item: NewsItem
  index: string
  title: string
  description?: string
}

const TRANSLATED_SOURCE_IDS = new Set<SourceID>(["producthunt", "github-trending-today", "indiehackers"])

function isTranslationEnabled(sourceId: SourceID) {
  return TRANSLATED_SOURCE_IDS.has(sourceId) && process.env.TRANSLATE_PROVIDER !== "false" && !!process.env.DEEPSEEK_API_KEY
}

function isLikelyEnglish(text: string) {
  const normalized = text.trim()
  if (!normalized || /[\u4E00-\u9FFF]/.test(normalized)) return false
  const letters = normalized.match(/[a-z]/gi)?.length ?? 0
  return letters >= 3 && letters / normalized.length > 0.25
}

function compactText(text?: string) {
  return text?.replace(/\s+/g, " ").trim()
}

function extractJson(content: string) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  const start = trimmed.indexOf("[")
  const end = trimmed.lastIndexOf("]")
  if (start === -1 || end === -1 || end <= start) return trimmed
  return trimmed.slice(start, end + 1)
}

async function getTranslationKey(sourceId: SourceID, item: NewsItem, title: string, description?: string) {
  const provider = process.env.TRANSLATE_PROVIDER || "deepseek"
  const target = process.env.TRANSLATE_TARGET || "zh-Hans"
  const hash = await md5(JSON.stringify({ title, description }))
  return `translation:${provider}:${target}:${sourceId}:${item.id}:${hash}`
}

async function requestTranslations(tasks: TranslationTask[]) {
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"
  const target = process.env.TRANSLATE_TARGET || "zh-Hans"
  const response: any = await myFetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            `Translate English news titles and short descriptions into ${target}.`,
            "Keep product names, repository names, company names, framework names, and technical terms unchanged when appropriate.",
            "Use concise, natural Simplified Chinese. Do not add explanations.",
            "Return strict JSON only: {\"items\":[{\"id\":\"...\",\"title\":\"...\",\"description\":\"...\"}]}",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            items: tasks.map(task => ({
              id: task.index,
              title: task.title,
              description: task.description,
            })),
          }),
        },
      ],
    }),
  })

  const content = response?.choices?.[0]?.message?.content
  if (!content) return new Map<string, TranslationResult>()

  const parsed = JSON.parse(extractJson(content))
  const items = Array.isArray(parsed) ? parsed : parsed.items
  const result = new Map<string, TranslationResult>()
  if (!Array.isArray(items)) return result

  items.forEach((item: any) => {
    if (!item?.id) return
    result.set(String(item.id), {
      title: compactText(item.title),
      description: compactText(item.description),
    })
  })
  return result
}

export async function translateNewsItems(sourceId: SourceID, items: NewsItem[]) {
  if (!isTranslationEnabled(sourceId) || !items.length) return items

  try {
    const cacheTable = await getTranslationCacheTable()
    if (!cacheTable) return items

    const tasks: TranslationTask[] = []
    await Promise.all(items.map(async (item, index) => {
      const title = compactText(item.title)
      const description = compactText(item.description)
      const text = [title, description].filter(Boolean).join("\n")
      if (!title || !isLikelyEnglish(text)) return

      const key = await getTranslationKey(sourceId, item, title, description)
      const cached = await cacheTable.get(key) as TranslationResult | undefined
      if (cached?.title || cached?.description) {
        item.translation = cached
        return
      }

      tasks.push({
        key,
        item,
        index: String(index),
        title,
        description,
      })
    }))

    const batchSize = Number(process.env.TRANSLATE_BATCH_SIZE || 30)
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize)
      const translations = await requestTranslations(batch)
      await Promise.all(batch.map(async (task) => {
        const translation = translations.get(task.index)
        if (!translation?.title && !translation?.description) return
        task.item.translation = translation
        await cacheTable.set(task.key, translation)
      }))
    }
  } catch (e) {
    logger.error("failed to translate news items ", e)
  }

  return items
}
