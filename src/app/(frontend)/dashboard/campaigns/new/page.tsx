'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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
import {
  getTemplateById,
  type EmailTemplate,
} from '@/lib/templates/catalog'

function NewCampaignPageInner() {
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [variables, setVariables] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const applyTemplate = useCallback(
    (template: EmailTemplate) => {
      setSubject(template.subject)
      setBody(template.body)
      setVariables(template.variables)
      setName((current) => current || template.name)
    },
    [],
  )

  useEffect(() => {
    const id = searchParams.get('templateId')
    if (!id) return
    const template = getTemplateById(id)
    if (template) applyTemplate(template)
  }, [searchParams, applyTemplate])

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
          <Button
            type="button"
            variant="outline"
            onClick={() => setPickerOpen(true)}
          >
            Browse templates
          </Button>
        </header>

        <form className="space-y-4">
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
        </form>

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
