import { parseMp4, trimMp4, type Parsed, type Session } from './mp4'

// Parsing a video means walking every sample table in the file; on a long
// recording that is seconds of work, and on the main thread it would freeze the
// page mid-drag. The session (the parsed samples) stays here between messages so
// that trimming, re-trimming and adjusting the marks never re-reads the file.

export type Req =
  | { id: number; kind: 'parse'; file: File }
  | { id: number; kind: 'trim'; start: number; end: number }

export type Res =
  | { id: number; kind: 'parsed'; parsed: Parsed }
  | { id: number; kind: 'trimmed'; blob: Blob; originSec: number; endSec: number }
  | { id: number; kind: 'error'; message: string }

let session: Session | null = null

self.onmessage = async (e: MessageEvent<Req>) => {
  const req = e.data
  try {
    if (req.kind === 'parse') {
      // The read happens here rather than on the main thread — a File handle
      // costs nothing to post, the bytes cost everything.
      const data = await req.file.arrayBuffer()
      const { session: s, parsed } = await parseMp4(data)
      session = s
      postMessage({ id: req.id, kind: 'parsed', parsed } satisfies Res)
      return
    }

    if (req.kind === 'trim') {
      if (!session) throw new Error('no-file')
      const { bytes, originSec, endSec } = await trimMp4(session, req.start, req.end)
      // A Blob rather than a transferred ArrayBuffer, as the other workers here
      // do: it is already a handle to the bytes, so nothing is copied either way.
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'video/mp4' })
      postMessage({ id: req.id, kind: 'trimmed', blob, originSec, endSec } satisfies Res)
      return
    }
  } catch (err) {
    postMessage({ id: req.id, kind: 'error', message: err instanceof Error ? err.message : String(err) } satisfies Res)
  }
}
