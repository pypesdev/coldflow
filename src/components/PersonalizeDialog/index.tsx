'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { diffLines, type DiffOp } from '@/lib/textDiff'

export type PersonalizeContactInput = {
  name: string
  company: string
  role: string
}

type PersonalizeResponse = {
  personalized_subject: string
  personalized_body: string
  used_variables: string[]
  original_subject: string
  original_body: string
  personalization_notes?: string
  usage: { input_tokens: number; output_tokens: number; model: string }
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: PersonalizeResponse }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateId: string | null
  currentSubject: string
  currentBody: string
  onApply: (subject: string, body: string) => void
}

export function PersonalizeDialog({
  open,
  onOpenChange,
  templateId,
  currentSubject,
  currentBody,
  onApply,
}: Props) {
  const [contact, setContact] = useState<PersonalizeContactInput>({
    name: '',
    company: '',
    role: '',
  })
  const [state, setState] = useState<State>({ kind: 'idle' })

  const reset = () => {
    setState({ kind: 'idle' })
  }

  const handleClose = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const canRun =
    state.kind !== 'loading' &&
    !!templateId &&
    contact.name.trim() !== '' &&
    contact.company.trim() !== '' &&
    contact.role.trim() !== ''

  const run = async () => {
    if (!templateId) return
    setState({ kind: 'loading' })
    try {
      const res = await fetch('/api/personalize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          contact: {
            name: contact.name.trim(),
            company: contact.company.trim(),
            role: contact.role.trim(),
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`)
      }
      setState({ kind: 'ready', data: data as PersonalizeResponse })
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personalize with AI</DialogTitle>
          <DialogDescription>
            Fill in a target contact and we&apos;ll add 1–2 personalization
            touches. Review the diff before applying.
          </DialogDescription>
        </DialogHeader>

        {!templateId && (
          <p className="text-sm text-muted-foreground">
            Pick a template first, then come back to personalize it.
          </p>
        )}

        {templateId && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="personalize-name">Name</Label>
              <Input
                id="personalize-name"
                value={contact.name}
                onChange={(e) =>
                  setContact((c) => ({ ...c, name: e.target.value }))
                }
                placeholder="Alex Chen"
              />
            </div>
            <div>
              <Label htmlFor="personalize-company">Company</Label>
              <Input
                id="personalize-company"
                value={contact.company}
                onChange={(e) =>
                  setContact((c) => ({ ...c, company: e.target.value }))
                }
                placeholder="Acme"
              />
            </div>
            <div>
              <Label htmlFor="personalize-role">Role</Label>
              <Input
                id="personalize-role"
                value={contact.role}
                onChange={(e) =>
                  setContact((c) => ({ ...c, role: e.target.value }))
                }
                placeholder="VP of Engineering"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button type="button" onClick={run} disabled={!canRun}>
            {state.kind === 'loading' ? 'Personalizing…' : 'Personalize'}
          </Button>
          {state.kind === 'error' && (
            <span className="text-sm text-red-600">{state.message}</span>
          )}
        </div>

        {state.kind === 'ready' && (
          <PersonalizePreview
            data={state.data}
            onApply={() => {
              onApply(
                state.data.personalized_subject,
                state.data.personalized_body,
              )
              handleClose(false)
            }}
            onDiscard={reset}
            currentSubject={currentSubject}
            currentBody={currentBody}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PersonalizePreview({
  data,
  onApply,
  onDiscard,
  currentSubject,
  currentBody,
}: {
  data: PersonalizeResponse
  onApply: () => void
  onDiscard: () => void
  currentSubject: string
  currentBody: string
}) {
  const subjectDiff = diffLines(
    currentSubject || data.original_subject,
    data.personalized_subject,
  )
  const bodyDiff = diffLines(
    currentBody || data.original_body,
    data.personalized_body,
  )
  return (
    <div className="space-y-4 mt-2" data-testid="personalize-preview">
      <section>
        <h3 className="text-sm font-semibold mb-1">Subject</h3>
        <DiffBlock ops={subjectDiff} />
      </section>
      <section>
        <h3 className="text-sm font-semibold mb-1">Body</h3>
        <DiffBlock ops={bodyDiff} />
      </section>
      {data.personalization_notes && (
        <p className="text-xs text-muted-foreground">
          <strong>Notes:</strong> {data.personalization_notes}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {data.used_variables.length > 0 && (
          <>
            <strong>Variables filled:</strong>{' '}
            {data.used_variables.map((v) => `{{${v}}}`).join(', ')}.{' '}
          </>
        )}
        <strong>Tokens:</strong> {data.usage.input_tokens} in /{' '}
        {data.usage.output_tokens} out ({data.usage.model}).
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={onApply}>
          Apply to draft
        </Button>
        <Button type="button" variant="outline" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </div>
  )
}

function DiffBlock({ ops }: { ops: DiffOp[] }) {
  return (
    <pre className="text-xs whitespace-pre-wrap font-mono border rounded bg-muted/40">
      {ops.map((op, idx) => (
        <DiffLine key={idx} op={op} />
      ))}
    </pre>
  )
}

function DiffLine({ op }: { op: DiffOp }) {
  const className =
    op.kind === 'add'
      ? 'block px-3 bg-green-100 text-green-900 dark:bg-green-950/60 dark:text-green-100'
      : op.kind === 'remove'
        ? 'block px-3 bg-red-100 text-red-900 line-through dark:bg-red-950/60 dark:text-red-100'
        : 'block px-3'
  const prefix = op.kind === 'add' ? '+ ' : op.kind === 'remove' ? '- ' : '  '
  return (
    <span className={className}>
      {prefix}
      {op.line}
    </span>
  )
}
