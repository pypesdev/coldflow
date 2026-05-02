'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  TEMPLATES,
  type EmailTemplate,
  type TemplateCategory,
} from '@/lib/templates/catalog'

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  saas: 'SaaS',
  agency: 'Agency',
  recruiting: 'Recruiting',
  b2b: 'B2B',
  founder: 'Founder',
  re_engagement: 'Re-engagement',
}

type TemplatePickerProps = {
  onUseTemplate: (template: EmailTemplate) => void
  useButtonLabel?: string
}

export function TemplatePicker({
  onUseTemplate,
  useButtonLabel = 'Use this template',
}: TemplatePickerProps) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const preview = previewId ? TEMPLATES.find((t) => t.id === previewId) : null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {TEMPLATES.map((template) => (
        <article
          key={template.id}
          className="border border-border rounded-lg p-4 flex flex-col bg-card"
          data-testid={`template-card-${template.id}`}
        >
          <div className="flex items-start justify-between mb-2 gap-2">
            <h3 className="font-semibold text-base">{template.name}</h3>
            <span className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground whitespace-nowrap">
              {CATEGORY_LABELS[template.category]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {template.description}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            <strong>Subject:</strong> {template.subject}
          </p>
          <div className="mt-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() =>
                setPreviewId(previewId === template.id ? null : template.id)
              }
            >
              {previewId === template.id ? 'Hide' : 'Preview'}
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={() => onUseTemplate(template)}
            >
              {useButtonLabel}
            </Button>
          </div>
          {preview && preview.id === template.id && (
            <pre className="mt-3 p-3 bg-muted rounded text-xs whitespace-pre-wrap font-mono">
              {preview.body}
            </pre>
          )}
        </article>
      ))}
    </div>
  )
}
