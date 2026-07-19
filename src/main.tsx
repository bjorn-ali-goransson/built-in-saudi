import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import './styles/tailwind.css'
import './styles/theme.css'

// pdf.js 6 (CV Generator) needs Promise.withResolvers, which some in-app browser
// WebViews (LinkedIn, Instagram, …) don't expose. Polyfill it before anything loads.
if (typeof (Promise as { withResolvers?: unknown }).withResolvers !== 'function') {
  ;(Promise as unknown as { withResolvers: <T>() => { promise: Promise<T>; resolve: (v: T) => void; reject: (e?: unknown) => void } }).withResolvers = function <T>() {
    let resolve!: (v: T) => void
    let reject!: (e?: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }
}

// pdf.js 6 also does `for await (… of readableStream)`. Async-iteration of
// ReadableStream is missing on some iOS/older WebViews — the iterator is undefined,
// which surfaces as "undefined is not a function (near '…n of e…')" and breaks the
// CV Generator's PDF read. Polyfill it (guarded — a no-op where already supported).
if (typeof ReadableStream !== 'undefined' && typeof (ReadableStream.prototype as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] !== 'function') {
  ;(ReadableStream.prototype as unknown as { [Symbol.asyncIterator]: () => AsyncIterableIterator<unknown> })[Symbol.asyncIterator] = function (this: ReadableStream) {
    const reader = this.getReader()
    return {
      next: () => reader.read() as Promise<IteratorResult<unknown>>,
      return(value?: unknown) { reader.releaseLock(); return Promise.resolve({ done: true, value } as IteratorResult<unknown>) },
      [Symbol.asyncIterator]() { return this },
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)

// Register the PWA service worker (installable + offline shell).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ })
  })
}
