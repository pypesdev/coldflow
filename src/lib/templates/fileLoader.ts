/**
 * Server-only loader for the markdown template pack at `templates/` (repo root).
 *
 * The runtime catalog in `./catalog.ts` is the source of truth for in-app preset
 * templates. The markdown pack is a curated starter library users can copy into
 * a campaign and a fallback source for the personalization endpoint.
 *
 * Reads the YAML front-matter and plaintext body, normalizes both into the same
 * `EmailTemplate` shape used by the catalog so `/api/personalize` can resolve a
 * template_id from either source transparently.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { parse as parseYaml } from 'yaml'
import {
  extractPlaceholders,
  type EmailTemplate,
  type TemplateCategory,
} from './catalog'

const TEMPLATES_DIR = path.join(process.cwd(), 'templates')
const FRONTMATTER_RE = /^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/

type FrontMatter = {
  id?: string
  name?: string
  category?: string
  persona?: string
  use_case?: string
  deliverability_notes?: string
  subject?: string
  variables?: string[]
}

const VALID_CATEGORIES: TemplateCategory[] = [
  'saas',
  'agency',
  'recruiting',
  'b2b',
  'founder',
  're_engagement',
]

function normalizeCategory(value: string | undefined): TemplateCategory {
  if (!value) return 'b2b'
  if (VALID_CATEGORIES.includes(value as TemplateCategory)) {
    return value as TemplateCategory
  }
  // Map HIR-103 categories to runtime categories.
  switch (value) {
    case 'sales':
      return 'b2b'
    case 'partnership':
      return 'b2b'
    case 'warm-intro':
      return 'b2b'
    case 'follow-up':
      return 're_engagement'
    default:
      return 'b2b'
  }
}

// Some template subjects start with `{{var}}`, which YAML 1.2 parses as a
// flow mapping and rejects. Quote these values before handing the block to
// the YAML parser so the existing HIR-103 templates load unchanged.
function quoteBraceLeadingValues(yamlBlock: string): string {
  return yamlBlock
    .split('\n')
    .map((line) => {
      const m = line.match(/^([ \t]*[a-zA-Z_][a-zA-Z0-9_]*:[ \t]+)(\{\{.*)$/)
      if (!m) return line
      const value = m[2]
      // Skip values already quoted on either side.
      if (/^["']/.test(value)) return line
      const escaped = value.replace(/'/g, "''")
      return `${m[1]}'${escaped}'`
    })
    .join('\n')
}

function parseTemplateFile(raw: string): EmailTemplate | null {
  const match = raw.match(FRONTMATTER_RE)
  if (!match) return null

  let fm: FrontMatter
  try {
    fm = parseYaml(quoteBraceLeadingValues(match[1])) as FrontMatter
  } catch {
    return null
  }

  const body = match[2].trimEnd().replace(/^\r?\n+/, '')
  if (!fm.id || !fm.subject || !body) return null

  const placeholders = new Set([
    ...extractPlaceholders(fm.subject),
    ...extractPlaceholders(body),
  ])
  const declared = Array.isArray(fm.variables) ? fm.variables : []
  const variables = Array.from(new Set([...declared, ...placeholders]))

  return {
    id: fm.id,
    name: fm.name || fm.id,
    category: normalizeCategory(fm.category),
    description: fm.use_case || fm.persona || '',
    subject: fm.subject,
    body,
    variables,
  }
}

async function* walkMarkdown(dir: string): AsyncGenerator<string> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walkMarkdown(full)
    } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
      yield full
    }
  }
}

let cache: Promise<Map<string, EmailTemplate>> | null = null

async function loadAll(): Promise<Map<string, EmailTemplate>> {
  const map = new Map<string, EmailTemplate>()
  for await (const file of walkMarkdown(TEMPLATES_DIR)) {
    let raw: string
    try {
      raw = await fs.readFile(file, 'utf8')
    } catch {
      continue
    }
    const template = parseTemplateFile(raw)
    if (template) map.set(template.id, template)
  }
  return map
}

export async function getFileTemplateById(
  id: string,
): Promise<EmailTemplate | undefined> {
  if (!cache) cache = loadAll()
  return (await cache).get(id)
}

export async function listFileTemplates(): Promise<EmailTemplate[]> {
  if (!cache) cache = loadAll()
  return Array.from((await cache).values())
}

// Test-only: clear the in-memory cache so a test can exercise fresh reads.
export function __resetFileTemplateCacheForTests() {
  cache = null
}
