// The strict CV shape. The backend asks OpenAI to emit exactly this (via a
// JSON schema), and template.ts renders it. Text fields may contain **markdown
// bold** markers — the model marks the keywords worth emphasising, and the
// renderer converts them to <b>. See docs: signal-not-noise guidelines.

export interface CvLink {
  label: string // "GitHub", "LinkedIn" — never the raw URL
  url: string
}

export interface CvContact {
  location?: string // country / city only, e.g. "Stockholm, Sweden"
  phone?: string // raw number, no "Phone:" label
  email?: string
  links: CvLink[]
}

export interface CvSkillGroup {
  category: string // "Languages & Core"
  items: string // "Java, SQL, REST"
}

export interface CvExperience {
  role: string
  company: string
  location?: string // omitted when same as the header location
  startYear?: string // year only
  endYear?: string // year only, or "Present"
  bullets: string[] // each may contain **bold**
}

export interface CvProject {
  name: string
  description: string // may contain **bold**
}

export interface CvDated {
  title: string
  detail?: string // venue / issuer
  year?: string
}

export interface CvEducation {
  degree: string
  institution?: string
  year?: string // year only; no GPA, no coursework
}

export interface CvLanguage {
  name: string
  level?: string // e.g. "Native", "Fluent", "B2"
}

export interface Cv {
  name: string
  role: string // headline title, e.g. "Senior Java Backend Engineer"
  available?: string // optional, e.g. "Open to Relocation (UAE / Saudi Arabia)"
  contact: CvContact
  summary: string // short, with **keywords** bolded; mentions years of experience
  skills: CvSkillGroup[]
  experience: CvExperience[]
  projects: CvProject[]
  talks: CvDated[]
  certifications: CvDated[]
  publications: CvDated[]
  education: CvEducation[]
  languages: CvLanguage[]
}

/** Build a filename like "Mirza Hussain CV 2026-07-06". */
export function cvFilename(cv: Cv, date = new Date()): string {
  const safe = (cv.name || 'Resume').replace(/[^\p{L}\p{N} .-]/gu, '').trim() || 'Resume'
  const d = date.toISOString().slice(0, 10)
  return `${safe} CV ${d}`
}
