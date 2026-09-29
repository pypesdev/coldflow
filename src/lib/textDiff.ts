/**
 * Line-by-line diff used by the AI personalization preview modal.
 *
 * Computes an LCS-based diff and returns a flat list of operations the UI can
 * render as a unified diff. Kept dependency-free because the only consumer is
 * a single client component and the inputs are short emails.
 */

export type DiffOp =
  | { kind: 'same'; line: string }
  | { kind: 'add'; line: string }
  | { kind: 'remove'; line: string }

export function diffLines(before: string, after: string): DiffOp[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const m = a.length
  const n = b.length

  // LCS length matrix.
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  )
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'same', line: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: 'remove', line: a[i] })
      i++
    } else {
      ops.push({ kind: 'add', line: b[j] })
      j++
    }
  }
  while (i < m) ops.push({ kind: 'remove', line: a[i++] })
  while (j < n) ops.push({ kind: 'add', line: b[j++] })
  return ops
}
