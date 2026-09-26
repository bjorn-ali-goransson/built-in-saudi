// The QR that reopens the sheet in the editor.
//
// The whole schedule travels in the URL fragment, so the QR is genuinely large
// — that is inherent, not a bug, and the alternative is a short link, which
// means a server, an account and a row in somebody's database for a sheet
// about when the biscuits are.
//
// What it must NOT do is print a code nobody can scan. Two limits bite:
//
//   - **Capacity.** A QR holds at most 2,953 bytes, and only at error
//     correction level L. Past that there is no code to print at all.
//   - **Density.** A 2,000-byte payload is about 145 modules across. Printed
//     into a 40mm corner that is 0.27mm per module, which a phone camera will
//     not resolve — so it would look like a working QR and be a picture.
//
// Both are reported rather than absorbed. A sheet whose QR cannot work says so
// on screen, before the PDF is made, and says which half of the problem it is.

import QRCode from 'qrcode'

/**
 * Level L on purpose.
 *
 * Error correction buys tolerance of damage and dirt, which is what a code on
 * a lorry or a packet needs. This one is printed on clean A4 and scanned from
 * a foot away, and every level above L costs capacity the schedule needs — M
 * would cut roughly a fifth off the number of activities that fit.
 */
const EC = 'L' as const

/** Modules of quiet zone. The spec says four; fewer and some readers refuse. */
export const QUIET = 4

/**
 * The smallest a printed module can be and still scan reliably from a phone.
 * Below this the code is decoration.
 */
const MIN_MODULE_MM = 0.42

/**
 * The most of the sheet the code is allowed to take.
 *
 * 60mm, and the number is load-bearing rather than a round one. The largest
 * QR there is — version 40, 177 modules — needs 185 × 0.42 = **77.7mm** at the
 * floor above, so any cap at or above that makes `too-dense` UNREACHABLE: the
 * refusal would be dead code and its test would pass against a tool that could
 * not produce the state. It shipped at 82 for exactly one build, and the only
 * reason that was found is that injecting a regression into the limit changed
 * nothing.
 *
 * 60mm is also the right answer on its own terms: the sheet is A4 landscape,
 * 210mm tall, and a code taking 82 of them leaves a grid nobody can read.
 */
const MAX_SIZE_MM = 60

export type QrPlan =
  | { ok: true; matrix: QrMatrix; modules: number; sizeMm: number; bytes: number }
  | { ok: false; reason: 'too-long' | 'too-dense'; bytes: number; modules: number; neededMm: number }

export interface QrMatrix {
  size: number
  get(x: number, y: number): boolean
}

export function planQr(url: string): QrPlan {
  const bytes = new TextEncoder().encode(url).length
  let qr: ReturnType<typeof QRCode.create>
  try {
    qr = QRCode.create(url, { errorCorrectionLevel: EC })
  } catch {
    // The only way `create` refuses is a payload past the largest version.
    return { ok: false, reason: 'too-long', bytes, modules: 0, neededMm: 0 }
  }
  const modules = qr.modules.size
  const across = modules + QUIET * 2
  const neededMm = across * MIN_MODULE_MM
  if (neededMm > MAX_SIZE_MM) {
    return { ok: false, reason: 'too-dense', bytes, modules, neededMm }
  }
  const matrix: QrMatrix = {
    size: modules,
    get: (x, y) => !!qr.modules.get(y, x),
  }
  return { ok: true, matrix, modules, sizeMm: neededMm, bytes }
}
