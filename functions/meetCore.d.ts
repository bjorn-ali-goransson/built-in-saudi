// Types for meetCore.js, for callers written in TypeScript (Sawi Kalam's tests).
export class MeetError extends Error { status: number; constructor(status: number, message: string) }
export interface MeetStore {
  get(col: string, id: string): Promise<Record<string, unknown> | null>
  set(col: string, id: string, obj: Record<string, unknown>): Promise<void>
  del(col: string, id: string): Promise<void>
}
export type MeetAction = 'registerOptions' | 'register' | 'loginOptions' | 'login' | 'create' | 'info' | 'claim'
export const MEET_ACTIONS: MeetAction[]
export function meetService(opts: { store: MeetStore; secret: string; rp: { id: string; name: string }; origins: string[]; now?: () => number }): Record<MeetAction, (body: Record<string, unknown>) => Promise<unknown>>
