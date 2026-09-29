/**
 * Template variable substitution.
 *
 * Replaces `{{name}}` placeholders in a string with values from a variables
 * map. Pure: no I/O, no globals, no side effects on the input map.
 *
 * Behavior:
 *   - Whitespace inside the braces is tolerated: `{{ first_name }}`.
 *   - Unknown placeholders are left as-is so missing data doesn't silently
 *     produce blank emails (the receiver sees `{{first_name}}`, not nothing).
 *   - Empty-string variable values DO substitute (this is a deliberate
 *     opt-in: callers can pass `''` to suppress a placeholder explicitly).
 *   - The brace syntax is regex-safe: variables containing `$` are not
 *     interpreted as backreferences during replacement.
 */
export function applyVariables(
  template: string,
  variables: Record<string, string> | undefined | null
): string {
  if (!template) return template
  if (!variables) return template

  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return variables[key]
    }
    return match
  })
}
