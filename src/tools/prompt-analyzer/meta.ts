import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { RadarIcon } from '../../components/icons'

export const promptAnalyzerTool: Tool = {
  id: 'prompt-analyzer',
  name: 'Prompt Analyzer',
  nameAr: 'محلّل الموجّهات',
  tagline: 'Grade your LLM prompt on a spider chart, with issues listed.',
  description:
    'Paste an LLM system prompt and one AI pass scores it 1–5 across eight dimensions — purpose coherence, context-vs-instruction harmony, spikiness, shoutiness, contradictions, positive framing, an escape hatch, and downstream stakes — shown as a heatmap spider chart, with concrete issues listed headline-first. Then answer the gaps it finds and a second pass rewrites your prompt into a stronger one. Built on the idea that the best prompt is a coherent explanation, not a pile of shouted commands. Three analyses per 24 hours.',
  category: 'Developer',
  keywords: [
    // Both spellings. This site writes British English in its own copy while
    // a keyword list, written by a developer, tends to the American form —
    // measured: 8 of 12 -ise/-ize variants missed, 5 returning nothing at all.
    'analyse', 'analyser',
    'prompt', 'llm', 'ai', 'prompt engineering', 'system prompt', 'analyze', 'grade', 'gpt', 'موجّه', 'ذكاء اصطناعي', 'هندسة الموجّهات', 'تحليل'],
  status: 'beta',
  Icon: RadarIcon,
  component: lazyTool(() => import('./PromptAnalyzerTool')),
  ar: {
    name: 'محلّل الموجّهات',
    tagline: 'قيّم موجّه نموذجك على مخطط عنكبوتي مع سرد المشكلات.',
    description:
      'الصق موجّه نظام لنموذج لغوي، فيقيّمه مرور واحد للذكاء الاصطناعي من ١ إلى ٥ عبر ثمانية أبعاد — تماسك الغرض، وتناغم السياق مع التعليمات، والحدّة، والصياح، والتناقضات، والصياغة الإيجابية، ومنفذ الخروج، ووضوح الاستخدام اللاحق — كمخطط عنكبوتي بألوان حرارية، مع سرد المشكلات بعناوينها. ثم أجب عن الثغرات ليعيد مرور ثانٍ صياغة موجّهك أقوى. مبنيّ على فكرة أن أفضل موجّه شرحٌ متماسك لا كومة أوامر مصيحة. ثلاثة تحاليل كل ٢٤ ساعة.',
  },
}
