// Types for findTimeCore.js, for callers written in TypeScript (e2e/find-time.spec.ts).
export class FindTimeError extends Error { status: number; constructor(status: number, message: string) }
export interface FindTimeStore {
  get(col: string, id: string): Promise<Record<string, unknown> | null>
  set(col: string, id: string, obj: Record<string, unknown>): Promise<void>
  del(col: string, id: string): Promise<void>
  /** Records in `col` whose array `field` contains `value`, each with its id. */
  find(col: string, field: string, value: string): Promise<({ id: string } & Record<string, unknown>)[]>
}
export type FindTimeAction = 'registerOptions' | 'register' | 'loginOptions' | 'login' | 'create' | 'get' | 'claim' | 'setAvail' | 'invite' | 'remove' | 'subscribe' | 'unsubscribe' | 'deletePoll' | 'myData' | 'deleteAccount'
export const FIND_TIME_ACTIONS: FindTimeAction[]
export const DAYS: number
export const SLOT_MIN: number
export const SLOTS: number
export const POLL_MS: number
export function validZone(tz: unknown): boolean
export function zonedMidnight(tz: string, t: number): number
export function everyoneSlots(people: { answered?: boolean; avail?: number[] }[]): number[]
export function findTimeService(opts: { store: FindTimeStore; secret: string; rp: { id: string; name: string }; origins: string[]; now?: () => number
  /** Sends one web push; throws with `statusCode` 404/410 for a subscription that is gone. */
  notify?: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: { title: string; body: string; url: string; tag: string }) => Promise<unknown>
  /** Where notification links point; defaults to the first origin. */
  site?: string }): Record<FindTimeAction, (body: Record<string, unknown>) => Promise<unknown>>
