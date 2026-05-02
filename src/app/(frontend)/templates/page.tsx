'use client'

import { useRouter } from 'next/navigation'
import { TemplatePicker } from '@/components/TemplatePicker'
import type { EmailTemplate } from '@/lib/templates/catalog'

export default function TemplatesPage() {
  const router = useRouter()

  const handleUse = (template: EmailTemplate) => {
    router.push(`/dashboard/campaigns/new?templateId=${template.id}`)
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Email templates</h1>
          <p className="text-muted-foreground">
            Pick a starting point for your next sequence. Each template uses{' '}
            <code className="text-xs px-1 py-0.5 bg-muted rounded">{`{{variable}}`}</code>{' '}
            placeholders that get replaced per-recipient.
          </p>
        </header>
        <TemplatePicker onUseTemplate={handleUse} />
      </div>
    </div>
  )
}
