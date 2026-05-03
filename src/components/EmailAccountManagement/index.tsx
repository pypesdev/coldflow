'use client'

import { useState } from 'react'
import { Mail, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type {
  ConnectImapRequest,
  EmailProvider,
  ConnectEmailAccountResponse,
} from '@/types/email'

interface EmailAccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EmailAccountModal({
  open,
  onOpenChange,
  onSuccess,
}: EmailAccountModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<EmailProvider | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // IMAP form state
  const [imapFormData, setImapFormData] = useState<Omit<ConnectImapRequest, 'provider'>>({
    email: '',
    imapHost: '',
    imapPort: 993,
    smtpHost: '',
    smtpPort: 587,
    username: '',
    password: '',
    useSsl: true,
  })

  const handleProviderSelect = (provider: EmailProvider) => {
    setSelectedProvider(provider)
    setError(null)
  }

  const handleBack = () => {
    setSelectedProvider(null)
    setError(null)
    setImapFormData({
      email: '',
      imapHost: '',
      imapPort: 993,
      smtpHost: '',
      smtpPort: 587,
      username: '',
      password: '',
      useSsl: true,
    })
  }

  const handleClose = () => {
    handleBack()
    onOpenChange(false)
  }

  const handleGmailConnect = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/email-accounts/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'gmail' }),
      })

      const data: ConnectEmailAccountResponse = await response.json()

      if (!response.ok || !data.success || !data.authUrl) {
        setError(data.error || 'Failed to start Gmail connection')
        return
      }

      // Redirect the browser to Google's OAuth consent screen. When the user
      // grants access, Google redirects back to /api/email-accounts/oauth/callback
      // which exchanges the code for refresh + access tokens and stores the
      // account in the database.
      window.location.href = data.authUrl
    } catch (_err) {
      setError('An error occurred while connecting Gmail account')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOutlookConnect = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/email-accounts/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'outlook' }),
      })

      const data: ConnectEmailAccountResponse = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to connect Outlook account')
        return
      }

      // Redirect to OAuth URL if provided
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else {
        onSuccess?.()
        handleClose()
      }
    } catch (err) {
      setError('An error occurred while connecting Outlook account')
    } finally {
      setSubmitting(false)
    }
  }

  const handleImapSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    // Validation
    if (!imapFormData.email || !imapFormData.imapHost || !imapFormData.smtpHost) {
      setError('Please fill in all required fields')
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/email-accounts/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'imap',
          ...imapFormData,
        }),
      })

      const data: ConnectEmailAccountResponse = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to connect IMAP account')
        return
      }

      onSuccess?.()
      handleClose()
    } catch (err) {
      setError('An error occurred while connecting IMAP account')
    } finally {
      setSubmitting(false)
    }
  }

  const updateImapFormData = (field: keyof typeof imapFormData, value: string | number | boolean) => {
    setImapFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          {!selectedProvider ? (
            <>
              <DialogHeader>
                <DialogTitle>Connect Email Account</DialogTitle>
                <DialogDescription>
                  Choose your email provider to get started
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <Card
                  className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
                  onClick={() => handleProviderSelect('gmail')}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                        <Mail className="h-6 w-6 text-red-600" />
                      </div>
                      <div>
                        <CardTitle>Gmail</CardTitle>
                        <CardDescription>
                          Connect your Google Workspace or Gmail account
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <Card
                  className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
                  onClick={() => handleProviderSelect('outlook')}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                        <Mail className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle>Outlook</CardTitle>
                        <CardDescription>
                          Connect your Microsoft 365 or Outlook account
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <Card
                  className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
                  onClick={() => handleProviderSelect('imap')}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                        <Server className="h-6 w-6 text-gray-600" />
                      </div>
                      <div>
                        <CardTitle>IMAP / SMTP</CardTitle>
                        <CardDescription>
                          Connect using custom IMAP and SMTP settings
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </div>
            </>
          ) : selectedProvider === 'gmail' ? (
            <>
              <DialogHeader>
                <DialogTitle>Connect Gmail Account</DialogTitle>
                <DialogDescription>
                  Sign in with your Google account to connect Gmail
                </DialogDescription>
              </DialogHeader>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-2 rounded-lg bg-muted p-4">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  Google will ask you to grant permission to read and send emails
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleBack} disabled={submitting}>
                  Back
                </Button>
                <Button onClick={handleGmailConnect} disabled={submitting}>
                  {submitting ? 'Connecting...' : 'Connect Gmail'}
                </Button>
              </DialogFooter>
            </>
          ) : selectedProvider === 'outlook' ? (
          <>
            <DialogHeader>
              <DialogTitle>Connect Outlook Account</DialogTitle>
              <DialogDescription>
                You'll be redirected to Microsoft to authorize access to your Outlook account
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 rounded-lg bg-muted p-4">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">
                Microsoft will ask you to grant permission to read and send emails
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleBack} disabled={submitting}>
                Back
              </Button>
              <Button onClick={handleOutlookConnect} disabled={submitting}>
                {submitting ? 'Connecting...' : 'Connect Outlook'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Connect IMAP / SMTP Account</DialogTitle>
              <DialogDescription>
                Enter your email server settings to connect
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleImapSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={imapFormData.email}
                    onChange={(e) => updateImapFormData('email', e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Usually your email address"
                    value={imapFormData.username}
                    onChange={(e) => updateImapFormData('username', e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Your email password"
                    value={imapFormData.password}
                    onChange={(e) => updateImapFormData('password', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="imapHost">IMAP Host *</Label>
                    <Input
                      id="imapHost"
                      type="text"
                      placeholder="imap.example.com"
                      value={imapFormData.imapHost}
                      onChange={(e) => updateImapFormData('imapHost', e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="imapPort">IMAP Port *</Label>
                    <Input
                      id="imapPort"
                      type="number"
                      placeholder="993"
                      value={imapFormData.imapPort}
                      onChange={(e) => updateImapFormData('imapPort', parseInt(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="smtpHost">SMTP Host *</Label>
                    <Input
                      id="smtpHost"
                      type="text"
                      placeholder="smtp.example.com"
                      value={imapFormData.smtpHost}
                      onChange={(e) => updateImapFormData('smtpHost', e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="smtpPort">SMTP Port *</Label>
                    <Input
                      id="smtpPort"
                      type="number"
                      placeholder="587"
                      value={imapFormData.smtpPort}
                      onChange={(e) => updateImapFormData('smtpPort', parseInt(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useSsl"
                    checked={imapFormData.useSsl}
                    onCheckedChange={(checked) => updateImapFormData('useSsl', checked === true)}
                  />
                  <Label
                    htmlFor="useSsl"
                    className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Use SSL/TLS (recommended)
                  </Label>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleBack} disabled={submitting}>
                  Back
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Connecting...' : 'Connect Account'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
