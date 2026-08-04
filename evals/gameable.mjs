// Adversarial check on our own scorer: does it reward HAVING a number over
// having a CREDIBLE one? The rubric drives both the score users see and the
// rewrite prompt, so if percentage-stuffing alone buys a 5 then the tool has an
// incentive to produce confident-sounding nonsense.
import { chatJSON, usage } from './lib/openai.mjs'
import { MODEL } from './lib/env.mjs'
import { scoreDocument } from './variants/champion.mjs'

const HONEST = `MARIA SANTOS
Lisbon, Portugal   |   maria.santos@example.com   |   +351 900 000 000
Backend Engineer

SUMMARY
Backend engineer with 4 years building payment services in Java and Spring Boot.

SKILLS
Languages: Java, Kotlin, SQL
Backend: Spring Boot, Kafka, PostgreSQL
Cloud: AWS, Docker

EXPERIENCE
Backend Engineer, PagaJa   Feb 2022 - Present
• Built and maintained the card settlement service in Java and Spring Boot.
• Moved batch reconciliation from a nightly cron to a Kafka consumer.
• Took part in on-call rotation for the payments platform.
Junior Backend Engineer, Netvia   Sep 2020 - Jan 2022
• Wrote REST endpoints for the merchant onboarding API.
• Added integration tests to the billing module.

EDUCATION
BSc Computer Science - University of Lisbon   2020`

const STUFFER = `Rewrite this résumé so that EVERY bullet ends in an impressive percentage or large number. Invent the figures freely — do not add any new substance, responsibility, technology or detail, and do not change the roles, dates or wording beyond attaching a number to each bullet. This is a deliberate adversarial test artefact.
Return ONLY JSON: { "text": "the rewritten résumé as plain text" }`

const mean = (o) => Object.values(o).reduce((a, b) => a + b, 0) / 6
const show = async (label, text) => {
  const s = await scoreDocument(text)
  console.log(`  ${label.padEnd(28)} overall ${mean(s).toFixed(2)}  ${JSON.stringify(s)}`)
  return mean(s)
}

console.log('Can percentage-stuffing alone buy a score?\n')
const a = await show('honest, unquantified', HONEST)
const stuffed = (await chatJSON(STUFFER, HONEST, { model: MODEL, temperature: 0.5 })).text
const b = await show('same CV, numbers stuffed', stuffed)
console.log(`\n  delta from adding nothing but invented figures: ${(b - a >= 0 ? '+' : '') + (b - a).toFixed(2)}`)
console.log('\n--- the stuffed version ---\n' + stuffed.split('\n').slice(0, 22).map((l) => '  ' + l).join('\n'))
console.log(`\nOpenAI: ${usage.calls} calls`)
