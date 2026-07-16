import process from "node:process"
import type { Database } from "db0"

interface TranslationCacheRow {
  id: string
  data: string
  updated: number
}

export class TranslationCache {
  private db
  constructor(db: Database) {
    this.db = db
  }

  async init() {
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS translation_cache (
        id TEXT PRIMARY KEY,
        updated INTEGER,
        data TEXT
      );
    `).run()
    logger.success(`init translation_cache table`)
  }

  async set(key: string, value: unknown) {
    const now = Date.now()
    await this.db.prepare(
      `INSERT OR REPLACE INTO translation_cache (id, data, updated) VALUES (?, ?, ?)`,
    ).run(key, JSON.stringify(value), now)
  }

  async get(key: string) {
    const row = (await this.db.prepare(`SELECT id, data, updated FROM translation_cache WHERE id = ?`).get(key)) as TranslationCacheRow | undefined
    if (row) return JSON.parse(row.data)
  }
}

export async function getTranslationCacheTable() {
  try {
    const db = useDatabase()
    if (process.env.ENABLE_CACHE === "false") return
    const cacheTable = new TranslationCache(db)
    if (process.env.INIT_TABLE !== "false") await cacheTable.init()
    return cacheTable
  } catch (e) {
    logger.error("failed to init translation cache table ", e)
  }
}
