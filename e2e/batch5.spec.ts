import { test, expect } from '@playwright/test'

test.describe('csv cleaner', () => {
  const MESSY = [
    'name, email ,city',
    ' Ahmed , a@example.com ,Riyadh',
    ' Ahmed , a@example.com ,Riyadh',
    '',
    'Fatimah,f@example.com,Jeddah',
  ].join('\n')
})
