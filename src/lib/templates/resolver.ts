/**
 * Resolve a template by id from either the runtime catalog or the markdown
 * starter pack at `templates/`. Used by `/api/personalize` so callers do not
 * need to know which source a template came from.
 */

import { getTemplateById, type EmailTemplate } from './catalog'
import { getFileTemplateById } from './fileLoader'

export async function resolveTemplateById(
  id: string,
): Promise<EmailTemplate | undefined> {
  return getTemplateById(id) ?? (await getFileTemplateById(id))
}
