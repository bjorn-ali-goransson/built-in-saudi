import { chromium } from '@playwright/test'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 2 })
p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
await p.goto('http://localhost:4271/ar/apps/activity-schedule/#t=sample')
await p.waitForSelector('[data-testid="as-sheet"]')
await p.waitForTimeout(700)
await p.getByTestId('as-sheet').screenshot({ path: 'C:/Users/a/AppData/Local/Temp/shots/new-sheet.png' })
// And the drawer, opened by tapping a lesson.
await p.locator('[data-testid="as-col-sun"] [data-testid^="as-item-"]').nth(1).click()
await p.waitForTimeout(400)
console.log('drawer open:', await p.getByTestId('as-drawer').count())
await p.screenshot({ path: 'C:/Users/a/AppData/Local/Temp/shots/new-drawer.png' })
await b.close()
