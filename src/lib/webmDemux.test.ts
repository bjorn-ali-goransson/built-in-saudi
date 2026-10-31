// The WebM/MKV reader, checked against what ffprobe counts in the same files
// and, for the Opus copy, against ffprobe reading the MP4 we write — somebody
// else's reader on both ends, never ours agreeing with ours.
import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { demuxWebm, looksLikeWebm, opusHeadToDops, opusSamples } from './webmDemux'
import { demuxVideo } from './videoDemux'
import { writeMp4 } from './mp4Writer'

const load = (name: string) => {
  const b = readFileSync(join(__dirname, '../../e2e/fixtures', name))
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}
const hasFfprobe = (() => { try { execFileSync('ffprobe', ['-version']); return true } catch { return false } })()
const packets = (file: string, stream: 'v' | 'a') => Number(execFileSync('ffprobe', [
  '-v', 'error', '-count_packets', '-select_streams', `${stream}:0`, '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', file,
]).toString().trim())

describe('webm demux', () => {
  it('sniffs EBML and nothing else', () => {
    expect(looksLikeWebm(load('recorded.webm'))).toBe(true)
    expect(looksLikeWebm(load('sample.mp4'))).toBe(false)
  })

  it('reads a recording whose Segment has unknown size and no Duration', async () => {
    const d = await demuxWebm(load('recorded.webm'))
    const v = d.tracks.find((t) => t.kind === 'video')!
    const a = d.tracks.find((t) => t.kind === 'audio')!
    expect(v.codec).toBe('vp09.00.41.08')
    expect(v.width).toBe(320)
    expect(v.height).toBe(240)
    expect(v.samples[0].sync).toBe(true)
    expect(d.keyframes[0]).toBe(0)
    expect(d.durationSec).toBeGreaterThan(5.9)
    expect(d.durationSec).toBeLessThan(6.1)
    expect(a.entryType).toBe('Opus')
    expect(a.timescale).toBe(48_000)
    // Opus durations read off the TOC add up to the clip, give or take the
    // pre-skip and the final partial frame.
    const total = a.samples.reduce((n, s) => n + s.duration, 0) / 48_000
    expect(Math.abs(total - 6)).toBeLessThan(0.1)
    // Samples are contiguous: each starts where the last one ended.
    for (let i = 1; i < a.samples.length; i++) expect(a.samples[i].dts).toBe(a.samples[i - 1].dts + a.samples[i - 1].duration)
    if (hasFfprobe) {
      const f = join(__dirname, '../../e2e/fixtures/recorded.webm')
      expect(v.samples.length).toBe(packets(f, 'v'))
      expect(a.samples.length).toBe(packets(f, 'a'))
    }
  })

  it('names Vorbis as sound an MP4 cannot carry, rather than dropping it silently', async () => {
    const d = await demuxVideo(load('vorbis.mkv'))
    expect(d.container).toBe('webm')
    expect(d.tracks.map((t) => t.kind)).toEqual(['video'])
    expect(d.tracks[0].codec).toBe('vp8')
    expect(d.uncopyableAudio).toBe('vorbis')
  })

  it('an MP4 still goes through mp4box', async () => {
    const d = await demuxVideo(load('sample.mp4'))
    expect(d.container).toBe('mp4')
    expect(d.tracks.some((t) => t.kind === 'audio')).toBe(true)
  })

  it.skipIf(!hasFfprobe)('the copied Opus is an MP4 Opus track another reader plays to length', async () => {
    const d = await demuxWebm(load('recorded.webm'))
    const a = d.tracks.find((t) => t.kind === 'audio')!
    const dir = mkdtempSync(join(tmpdir(), 'opus-'))
    const out = join(dir, 'a.mp4')
    writeFileSync(out, writeMp4([a]))
    const info = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration', '-of', 'json', out]).toString()
    const j = JSON.parse(info)
    expect(j.streams[0].codec_name).toBe('opus')
    expect(Number(j.streams[0].sample_rate)).toBe(48000)
    expect(Math.abs(Number(j.format.duration) - 6)).toBeLessThan(0.1)
    // And it decodes, end to end, without an error.
    execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', out, '-f', 'null', '-'])
  })
})

describe('opus helpers', () => {
  it('dOps is OpusHead with its byte order turned round', () => {
    const head = new Uint8Array([...new TextEncoder().encode('OpusHead'), 1, 2, 0x38, 0x01, 0x80, 0xbb, 0, 0, 0xfe, 0xff, 0])
    const dops = opusHeadToDops(head)!
    expect(new TextDecoder().decode(dops.subarray(4, 8))).toBe('dOps')
    expect(Array.from(dops.subarray(8))).toEqual([0, 2, 0x01, 0x38, 0, 0, 0xbb, 0x80, 0xff, 0xfe, 0])
  })

  it('reads a packet\'s length from its TOC', () => {
    expect(opusSamples(new Uint8Array([0xfc]))).toBe(960) // CELT 20ms, one frame
    expect(opusSamples(new Uint8Array([0xe1]))).toBe(240) // config 28 = CELT 2.5ms, code 1 = two frames
    expect(opusSamples(new Uint8Array([0x1b, 0x03]))).toBe(2880 * 3) // config 3 = SILK 60ms, code 3 = a count byte of 3
  })
})
