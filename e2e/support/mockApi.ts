import type { Page, Route } from '@playwright/test'
import { expect } from '@playwright/test'

// A lightweight, moq-like mock harness for e2e. It intercepts requests with
// Playwright's `page.route` (no separate server process) and lets a test declare,
// per URL glob, any outcome — a success body, an HTTP error (401/403/404/429/500),
// malformed JSON, or a slow/"timeout" response — while COUNTING calls so tests can
// assert "this endpoint was hit exactly N times" instead of scouring logs.
//
// Two ways to vary a response:
//   • a static Stub                          → same every time
//   • a function (info) => Stub | Promise    → branch on the request; e.g. inspect
//     info.body for a "poison" id and fail only that one.
//
// Usage:
//   const api = new MockApi(page)
//   await api.on('**/cv-generate', ok(GEN))
//   await api.on('**/cv-refine', ({ body }) => body?.kind === 'improve' ? ok(IMP) : fail(400))
//   … drive the UI …
//   api.expectCalled('**/cv-generate', 1)

export interface Stub {
  status?: number // default 200
  json?: unknown // JSON body (ignored if `body` is set)
  body?: string // raw body — use for malformed JSON, empty bodies, etc.
  contentType?: string // default application/json
  headers?: Record<string, string>
  delayMs?: number // simulate latency; large values simulate a timeout
  abort?: boolean // drop the connection (network error) instead of replying
}

export interface ReqInfo {
  url: string
  method: string
  body: any // parsed JSON when possible, else the raw string, else undefined
  count: number // 1-based call index for this pattern
}

export type Responder = Stub | ((info: ReqInfo) => Stub | Promise<Stub>)

export class MockApi {
  private counts = new Map<string, number>()
  private log: { pattern: string; url: string; method: string; body: any }[] = []

  constructor(private page: Page) {}

  /** Register a mock for every request matching `pattern` (a Playwright URL glob). */
  async on(pattern: string, responder: Responder): Promise<this> {
    this.counts.set(pattern, 0)
    await this.page.route(pattern, async (route: Route) => {
      const req = route.request()
      let body: any
      try { body = req.postDataJSON() } catch { body = req.postData() ?? undefined }
      const count = (this.counts.get(pattern) || 0) + 1
      this.counts.set(pattern, count)
      this.log.push({ pattern, url: req.url(), method: req.method(), body })
      const stub = typeof responder === 'function' ? await responder({ url: req.url(), method: req.method(), body, count }) : responder
      if (stub.abort) return route.abort('failed')
      if (stub.delayMs) await new Promise((r) => setTimeout(r, stub.delayMs))
      await route.fulfill({
        status: stub.status ?? 200,
        contentType: stub.contentType ?? 'application/json',
        headers: stub.headers,
        body: stub.body ?? JSON.stringify(stub.json ?? {}),
      })
    })
    return this
  }

  /** How many times a pattern was hit. */
  calls(pattern: string): number {
    return this.counts.get(pattern) || 0
  }

  /** moq-style assertion: the endpoint was called exactly `n` times. */
  expectCalled(pattern: string, n: number): void {
    expect(this.calls(pattern), `${pattern} should be called ${n}×`).toBe(n)
  }

  /** The recorded request bodies for a pattern (for asserting what was sent). */
  bodies(pattern: string): any[] {
    return this.log.filter((e) => e.pattern === pattern).map((e) => e.body)
  }

  reset(): void {
    this.counts.forEach((_, k) => this.counts.set(k, 0))
    this.log = []
  }
}

// ── Outcome presets ────────────────────────────────────────────────────────
export const ok = (json: unknown): Stub => ({ status: 200, json })
export const fail = (status: number, error = 'mock error'): Stub => ({ status, json: { error } })
export const unauthorized = (): Stub => fail(401, 'sign in first')
export const forbidden = (): Stub => fail(403, 'forbidden')
export const notFound = (): Stub => fail(404, 'not found')
export const rateLimited = (msg = 'Limit reached — try again later.'): Stub => fail(429, msg)
export const serverError = (): Stub => fail(500, 'internal error')
export const malformed = (): Stub => ({ status: 200, body: 'not json {' })
export const slow = (delayMs = 35_000, json: unknown = {}): Stub => ({ status: 200, json, delayMs })
export const networkError = (): Stub => ({ abort: true })

// ── Google Identity Services stub ──────────────────────────────────────────
// Installs a fake window.google.accounts.id so a signed-in flow can run without
// hitting Google: prompt()/renderButton both sign the user in with `credential`.
export async function stubGoogleSignIn(page: Page, credential = 'test.jwt.token'): Promise<void> {
  await page.addInitScript((cred: string) => {
    const cb = { current: null as null | ((r: { credential: string }) => void) }
    const id = {
      initialize(cfg: { callback: (r: { credential: string }) => void }) { cb.current = cfg && cfg.callback },
      renderButton(el: HTMLElement) {
        const b = document.createElement('button')
        b.textContent = 'Mock sign in'
        b.onclick = () => cb.current?.({ credential: cred })
        el.appendChild(b)
      },
      disableAutoSelect() {},
      prompt() { cb.current?.({ credential: cred }) },
    }
    ;(window as unknown as { google: unknown }).google = { accounts: { id } }
  }, credential)
}
