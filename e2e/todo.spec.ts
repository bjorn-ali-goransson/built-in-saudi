import { test, expect } from '@playwright/test'
import { MockApi, ok, serverError, stubGoogleSignIn } from './support/mockApi'

// The to-do tool is local-first; only the networked sync/share path was untested.

test('todo: enabling sync signs in and pushes the list (mocked)', async ({ page }) => {
  const api = new MockApi(page)
  await stubGoogleSignIn(page)
  await api.on('**/todo-mine', ok({ lists: [] }))
  await api.on('**/todo-sync', ({ body }) => ok({ list: body?.list }))

  await page.goto('/en/apps/todo')
  await expect(page.getByTestId('todo')).toBeVisible()

  // Add an item to the default list.
  await page.getByTestId('todo-input').fill('Buy milk')
  await page.getByTestId('todo-add').click()
  await expect(page.getByTestId('todo-item')).toHaveCount(1)

  // Enable sync → sign in on demand → the list is pushed and marked synced.
  await page.getByTestId('todo-enable-sync').click()
  await page.getByTestId('todo-sync-go').click()
  await expect(page.getByTestId('todo-synced')).toBeVisible()
  api.expectCalled('**/todo-sync', 1)
  // The list we pushed carried the item.
  expect(api.bodies('**/todo-sync')[0]?.list?.items?.length).toBe(1)
})

test('todo: a sync failure surfaces an error and stays local', async ({ page }) => {
  const api = new MockApi(page)
  await stubGoogleSignIn(page)
  await api.on('**/todo-mine', ok({ lists: [] }))
  await api.on('**/todo-sync', serverError())

  await page.goto('/en/apps/todo')
  await page.getByTestId('todo-input').fill('Task')
  await page.getByTestId('todo-add').click()
  await page.getByTestId('todo-enable-sync').click()
  await page.getByTestId('todo-sync-go').click()

  await expect(page.getByTestId('todo-sync-err')).toBeVisible()
  await expect(page.getByTestId('todo-synced')).toHaveCount(0) // still local
})
