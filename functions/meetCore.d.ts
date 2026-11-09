// Types for meetCore.js, for callers written in TypeScript (Sawi Kalam's tests).
export class MeetError extends Error { status: number; constructor(status: number, message: string) }
export interface MeetStore {
  get(col: string, id: string): Promise<Record<string, unknown> | null>
  set(col: string, id: string, obj: Record<string, unknown>): Promise<void>
  del(col: string, id: string): Promise<void>
  /** Records in `col` whose `field` equals `value`, each with its id. */
  find(col: string, field: string, value: string): Promise<({ id: string } & Record<string, unknown>)[]>
}
export type MeetAction = 'registerOptions' | 'register' | 'loginOptions' | 'login' | 'create' | 'info' | 'claim' | 'schedule' | 'respond' | 'confirm' | 'subscribe' | 'setBackground' | 'background' | 'myData' | 'deleteMeeting' | 'deleteAccount'
export const MEET_ACTIONS: MeetAction[]
export function meetService(opts: { store: MeetStore; secret: string; rp: { id: string; name: string }; origins: string[]; now?: () => number
  /** Sends one web push; throws with `statusCode` 404/410 for a subscription that is gone. */
  notify?: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: { title: string; body: string; url: string; tag: string }) => Promise<unknown>
  /** Where notification links point; defaults to the first origin. */
  site?: string }): Record<MeetAction, (body: Record<string, unknown>) => Promise<unknown>>
