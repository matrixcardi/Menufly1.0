/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcomeMenufly } from './welcome-menufly.tsx'
import { template as trialReminder } from './trial-reminder.tsx'
import { template as subscriptionRenewal } from './subscription-renewal.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome-menufly': welcomeMenufly,
  'trial-reminder': trialReminder,
  'subscription-renewal': subscriptionRenewal,
}
