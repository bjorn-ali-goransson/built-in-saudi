import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { HashIcon } from '../../components/icons'

export const tokenCounterTool: Tool = {
  id: 'token-counter',
  // Deliberately NOT "Token Counter" alone: `jwt-decoder` legitimately owns the
  // word token for the thing an API hands you, and `text-counter` owns
  // "counter". The qualifier is what keeps all three findable.
  name: 'AI Token Counter',
  tagline: 'Exactly how many tokens your prompt costs — not an estimate.',
  description:
    'Paste a prompt, a document or a system message and get the exact token count from the real tokenizer, for GPT-4o-era and GPT-4-era models. See how far the usual "characters ÷ 4" guess is out, whether the text fits your context window, and what it costs at a price you supply. Arabic costs far more tokens per character than English — this shows by how much. Runs entirely in your browser, so a confidential prompt never leaves the page.',
  category: 'Developer',
  keywords: [
    'tokens', 'token count', 'tokenizer', 'tokenize', 'llm', 'gpt', 'openai', 'context window',
    'prompt size', 'how many tokens', 'token cost', 'api cost', 'context limit', 'too long',
    'cl100k', 'o200k', 'tiktoken', 'bpe', 'prompt', 'ai cost',
    'توكن', 'توكنز', 'عدد التوكنز', 'حجم التعليمة', 'نافذة السياق', 'تكلفة النموذج', 'ذكاء اصطناعي',
  ],
  status: 'stable',
  Icon: HashIcon,
  component: lazyTool(() => import('./TokenCounterTool')),
  ar: {
    name: 'عدّاد توكنز الذكاء الاصطناعي',
    tagline: 'كم توكن تكلّف تعليمتك بالضبط — لا تقديرًا.',
    description:
      'ألصق تعليمة أو مستندًا أو رسالة نظام واحصل على عدد التوكنز الدقيق من المُجزّئ الحقيقي، لنماذج جيل GPT-4o وجيل GPT-4. واعرف كم تبتعد قاعدة «الحروف ÷ ٤» عن الحقيقة، وهل يتّسع النص في نافذة السياق، وكم يكلّف بسعر تُدخله أنت. والعربية تكلّف توكنز أكثر بكثير من الإنجليزية لكل حرف — وهنا ترى بكم. يعمل بالكامل داخل متصفحك، فلا تغادر تعليمتك السرّية الصفحة.',
  },
}
