'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TemplatePicker } from '@/components/TemplatePicker'
import { PersonalizeDialog } from '@/components/PersonalizeDialog'
import {
  getTemplateById,
  type EmailTemplate,
} from '@/lib/templates/catalog'
import { parseRecipients } from '@/lib/recipientParser'

type EmailAccount = {
  id: string
  email: string
  provider: string
  status: string
}

type SubmitResult =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; campaignId: string; queued: number }
  | { kind: 'error'; message: string }

function NewCampaignPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [variables, setVariables] = useState<string[]>([])
  const [recipientsInput, setRecipientsInput] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [personalizeOpen, setPersonalizeOpen] = useState(false)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [emailAccountId, setEmailAccountId] = useState('')
  const [submit, setSubmit] = useState<SubmitResult>({ kind: 'idle' })

  const applyTemplate = useCallback((template: EmailTemplate) => {
    setSubject(template.subject)
    setBody(template.body)
    setVariables(template.variables)
    setActiveTemplateId(template.id)
    setName((current) => current || template.name)
  }, [])

  useEffect(() => {
    const id = searchParams.get('templateId')
    if (!id) return
    const template = getTemplateById(id)
    if (template) applyTemplate(template)
  }, [searchParams, applyTemplate])

  useEffect(() => {
    let cancelled = false
    fetch('/api/email-accounts')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || `Failed to load (${res.status})`)
        }
        return data.accounts as EmailAccount[]
      })
      .then((list) => {
        if (cancelled) return
        const connected = list.filter((a) => a.status === 'connected')
        setAccounts(connected)
        if (connected.length === 1) setEmailAccountId(connected[0].id)
      })
      .catch((err) => {
        if (cancelled) return
        setAccountsError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const parsed = useMemo(() => parseRecipients(recipientsInput), [recipientsInput])
  const canSubmit =
    submit.kind !== 'submitting' &&
    name.trim().length > 0 &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    parsed.recipients.length > 0 &&
    emailAccountId.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmit({ kind: 'submitting' })
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          emailAccountId,
          recipients: parsed.recipients,
          subject: subject.trim(),
          bodyText: body,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Request failed (${res.status})`)
      }
      const campaignId = data.campaign?.id ?? ''
      setSubmit({
        kind: 'success',
        campaignId,
        queued: data.queuedEmails ?? parsed.recipients.length,
      })
      if (campaignId) {
        router.push(`/dashboard/campaigns/${campaignId}`)
      }
    } catch (err) {
      setSubmit({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">New sequence</h1>
            <p className="text-muted-foreground text-sm">
              Single-step email sequence. Use{' '}
              <code className="text-xs px-1 py-0.5 bg-muted rounded">{`{{first_name}}`}</code>{' '}
              and other variables that get replaced per recipient.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(true)}
            >
              Browse templates
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPersonalizeOpen(true)}
              disabled={!activeTemplateId}
              title={
                activeTemplateId
                  ? 'Add 1–2 AI personalization touches for a specific contact'
                  : 'Pick a template first'
              }
              data-testid="personalize-with-ai-button"
            >
              Personalize with AI
            </Button>
          </div>
        </header>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="campaign-name">Name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SaaS onboarding — May launch"
            />
          </div>

          <div>
            <Label htmlFor="campaign-account">Send from</Label>
            {accountsError ? (
              <p className="text-sm text-red-600 mt-1">
                Couldn&apos;t load accounts: {accountsError}
              </p>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">
                No connected email accounts.{' '}
                <a className="underline" href="/dashboard/email-accounts">
                  Connect one
                </a>{' '}
                to send.
              </p>
            ) : (
              <select
                id="campaign-account"
                className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm"
                value={emailAccountId}
                onChange={(e) => setEmailAccountId(e.target.value)}
              >
                <option value="" disabled>
                  Choose a connected account
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.email} ({a.provider})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <Label htmlFor="campaign-recipients">Recipients</Label>
            <Textarea
              id="campaign-recipients"
              value={recipientsInput}
              onChange={(e) => setRecipientsInput(e.target.value)}
              rows={6}
              placeholder={'alice@example.com\nBob Smith <bob@example.com>'}
            />
            <p className="text-xs text-muted-foreground mt-1">
              One per line, comma, or semicolon. Optional{' '}
              <code className="text-xs">Name &lt;email&gt;</code> form.
              Parsed: <strong>{parsed.recipients.length}</strong> valid
              {parsed.invalid.length > 0 && (
                <>
                  , <span className="text-red-600">{parsed.invalid.length} invalid</span>
                </>
              )}
              .
            </p>
          </div>

          <div>
            <Label htmlFor="campaign-subject">Subject</Label>
            <Input
              id="campaign-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Welcome to {{product_name}}, {{first_name}}"
            />
          </div>

          <div>
            <Label htmlFor="campaign-body">Body</Label>
            <Textarea
              id="campaign-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              placeholder="Hi {{first_name}}, ..."
            />
          </div>

          {variables.length > 0 && (
            <div>
              <Label>Variables in this template</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {variables.map((v) => (
                  <code
                    key={v}
                    className="text-xs px-2 py-1 bg-muted rounded"
                  >
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={!canSubmit}>
              {submit.kind === 'submitting' ? 'Creating…' : 'Create campaign'}
            </Button>
            {submit.kind === 'success' && (
              <span className="text-sm text-green-600">
                Queued {submit.queued} email{submit.queued === 1 ? '' : 's'}.
              </span>
            )}
            {submit.kind === 'error' && (
              <span className="text-sm text-red-600">{submit.message}</span>
            )}
          </div>
        </form>

        <PersonalizeDialog
          open={personalizeOpen}
          onOpenChange={setPersonalizeOpen}
          templateId={activeTemplateId}
          currentSubject={subject}
          currentBody={body}
          onApply={(newSubject, newBody) => {
            setSubject(newSubject)
            setBody(newBody)
          }}
        />

        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Browse templates</DialogTitle>
              <DialogDescription>
                Pick one to prefill subject and body. You can edit after
                applying.
              </DialogDescription>
            </DialogHeader>
            <TemplatePicker
              useButtonLabel="Use this template"
              onUseTemplate={(template) => {
                applyTemplate(template)
                setPickerOpen(false)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default function NewCampaignPage() {
  return (
    <Suspense fallback={null}>
      <NewCampaignPageInner />
    </Suspense>
  )
}
