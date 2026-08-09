// Saudi university GPA, and the conversion everybody gets wrong.
//
// SOURCES — checked 9 August 2026
//   Ministry of Education, Unified Regulations for Undergraduate Studies —
//   moe.gov.sa. The points and the classification bands below are the
//   MoE-standardised scheme, corroborated against three university registrars
//   that publish it: King Saud University (dar.ksu.edu.sa), Prince Sattam bin
//   Abdulaziz University and Umm Al-Qura University. Most public universities
//   use the 5.00 scale; some institutions use 4.00.
//   Saudi Arabian Cultural Mission (sacm.org) publishes the same two scales for
//   credential evaluation abroad.
//
// Found by a web sweep of the student-tools market: a GPA calculator is on
// every one of those sites and we had none — only `admission-score`, which
// weights Qudurat and Tahsili for ADMISSION and is a different question.
//
// **The reason this is worth building is one number: F is 1.00 on the 5-point
// scale, not 0.** So the two scales are not linear images of one another, and
// the `(GPA ÷ 5) × 4` formula that every calculator on the web publishes is
// wrong in a direction that flatters a weak record: a student with straight Ds
// has 2.00/5, which that formula reports as 1.60/4 where the actual grade
// mapping gives 1.00/4. Converting grade by grade is exact and needs nothing
// but the letters the student already typed.

export type Letter = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D+' | 'D' | 'F'

export const LETTERS: Letter[] = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F']

/** Points per letter on each scale. Note F: 1.00 on five, 0.00 on four. */
export const POINTS: Record<'five' | 'four', Record<Letter, number>> = {
  five: { 'A+': 5.00, A: 4.75, 'B+': 4.50, B: 4.00, 'C+': 3.50, C: 3.00, 'D+': 2.50, D: 2.00, F: 1.00 },
  four: { 'A+': 4.00, A: 3.75, 'B+': 3.50, B: 3.00, 'C+': 2.50, C: 2.00, 'D+': 1.50, D: 1.00, F: 0.00 },
}

/** The percentage each letter is awarded for, as the registrars publish it. */
export const RANGES: Record<Letter, string> = {
  'A+': '95–100', A: '90–94', 'B+': '85–89', B: '80–84',
  'C+': '75–79', C: '70–74', 'D+': '65–69', D: '60–64', F: '< 60',
}

export interface Course { name: string; credits: number; grade: Letter }

export interface GpaResult {
  gpa: number
  credits: number
  points: number
  /** The same courses scored on the OTHER scale, grade by grade. */
  converted: number
  /** What `(gpa / 5) * 4` — the formula everyone publishes — would have said. */
  linear: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function calcGpa(courses: Course[], scale: 'five' | 'four', prior?: { gpa: number; credits: number }): GpaResult {
  const valid = courses.filter((c) => c.credits > 0)
  let points = valid.reduce((n, c) => n + POINTS[scale][c.grade] * c.credits, 0)
  let credits = valid.reduce((n, c) => n + c.credits, 0)

  // A cumulative GPA is the prior points added back in, NOT the average of two
  // averages — a 4.0 over 100 credits and a 3.0 over 3 credits is not 3.5.
  if (prior && prior.credits > 0) {
    points += prior.gpa * prior.credits
    credits += prior.credits
  }

  const gpa = credits ? points / credits : 0
  const other = scale === 'five' ? 'four' : 'five'
  const otherPoints = valid.reduce((n, c) => n + POINTS[other][c.grade] * c.credits, 0)
    + (prior && prior.credits > 0
      // The prior GPA has no letters behind it, so it can only be carried over
      // linearly. That is stated in the UI rather than hidden.
      ? (scale === 'five' ? (prior.gpa / 5) * 4 : (prior.gpa / 4) * 5) * prior.credits
      : 0)

  return {
    gpa: round2(gpa),
    credits,
    points: round2(points),
    converted: round2(credits ? otherPoints / credits : 0),
    linear: round2(scale === 'five' ? (gpa / 5) * 4 : (gpa / 4) * 5),
  }
}

export type Grade = 'excellent' | 'veryGood' | 'good' | 'pass' | 'below'

/**
 * The overall classification (التقدير العام).
 *
 * Bands are published on the 5.00 scale; the 4.00 equivalents are the same
 * boundaries scaled, which is how the registrars that use 4.00 publish them.
 */
export function classify(gpa: number, scale: 'five' | 'four'): Grade {
  const g = scale === 'five' ? gpa : (gpa / 4) * 5
  if (g >= 4.5) return 'excellent'
  if (g >= 3.75) return 'veryGood'
  if (g >= 2.75) return 'good'
  if (g >= 2) return 'pass'
  return 'below'
}
