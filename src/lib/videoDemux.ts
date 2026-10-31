// One door for every video container the editors read: MP4/MOV through
// mp4box, WebM/MKV through the EBML reader. Decided by the BYTES, never the
// extension — a phone hands a file over with whatever name and MIME it likes.

import { demuxMp4, type Demuxed, type DemuxTrack } from './mp4Demux'
import { demuxWebm, looksLikeWebm } from './webmDemux'

export type AnyDemuxed = Demuxed & {
  /**
   * A sound track that exists and cannot be carried into an MP4 without
   * re-encoding (Vorbis). Named so the page says why the export is silent
   * instead of claiming the clip had no sound.
   */
  uncopyableAudio?: string
  container: 'mp4' | 'webm'
}

export async function demuxVideo(data: ArrayBuffer): Promise<AnyDemuxed> {
  if (looksLikeWebm(data)) return { ...(await demuxWebm(data)), container: 'webm' }
  return { ...(await demuxMp4(data)), container: 'mp4' }
}

/**
 * The `description` a VideoDecoder is configured with: the configuration
 * box's payload, or nothing at all. VP8 and VP9 have none, and handing a
 * decoder an empty description for them is a configuration some engines
 * refuse.
 */
export function decoderDescription(t: DemuxTrack): Uint8Array | undefined {
  return t.config.byteLength > 8 ? t.config.subarray(8) : undefined
}
