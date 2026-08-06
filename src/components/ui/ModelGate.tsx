import type { ReactNode } from 'react'
import type { Locale } from '../../i18n'
import type { ModelState } from '../../lib/builtinAi'
import { Button } from './Button'
import { Panel } from './primitives'
import { Spinner } from './Spinner'
import { DownloadIcon } from '../icons'

// The states of an on-device model, rendered once so the translator and the
// summariser cannot drift apart in how they explain themselves.
//
// The unsupported case is the one that matters. Most visitors are on a phone,
// where none of this exists, and the wrong move is a dead button or a silent
// no-op. It says what is missing, what would fix it, and — because this is the
// whole reason the tool is interesting — that the alternative would have been
// uploading their text to somebody.

const STR = {
  en: {
    unsupportedTitle: 'Your browser cannot run this yet',
    unsupportedBody:
      'This tool uses a model that runs on your device, so your text never leaves this page. That needs Chrome or Edge 138 or newer on Windows, macOS, Linux or ChromeOS — Firefox and Safari have nothing like it, and neither do phones yet. Some builds offer the feature but have no model to run, usually for want of disk space.',
    unsupportedWhyNot:
      'We could have made it work everywhere by sending your text to a server instead. That is what every free translator and summariser does, and it is the thing this site exists not to do.',
    downloadableTitle: 'One-off download needed',
    download: 'Download the model',
    downloadNote:
      'The model is fetched from Google once and then cached by your browser. That request carries none of your text — but it is a request to a third party, so you should know it happens. It can be a few hundred megabytes, so use Wi-Fi.',
    downloading: 'Downloading the model',
    downloadingNote: 'This happens once. Leaving this page will cancel it.',
    checking: 'Checking what your browser can do…',
    errorTitle: 'That did not work',
    retry: 'Try again',
  },
  ar: {
    unsupportedTitle: 'متصفحك لا يستطيع تشغيل هذه الأداة بعد',
    unsupportedBody:
      'تستخدم هذه الأداة نموذجًا يعمل على جهازك، فلا يغادر نصُّك هذه الصفحة. وهذا يتطلب Chrome أو Edge بإصدار ١٣٨ أو أحدث على ويندوز أو macOS أو لينكس أو ChromeOS — ولا يوجد ما يشبهه في Firefox أو Safari، ولا في الهواتف بعد. وبعض النسخ تتيح الميزة دون أن يتوفر لها نموذج، غالبًا لضيق مساحة القرص.',
    unsupportedWhyNot:
      'كان بإمكاننا تشغيلها في كل مكان بإرسال نصك إلى خادم. وهذا ما يفعله كل مترجم ومُلخِّص مجاني، وهو تحديدًا ما وُجد هذا الموقع لتجنّبه.',
    downloadableTitle: 'يلزم تنزيل لمرة واحدة',
    download: 'نزّل النموذج',
    downloadNote:
      'يُجلب النموذج من Google مرة واحدة ثم يخزّنه متصفحك. ولا يحمل هذا الطلب شيئًا من نصك — لكنه طلب إلى طرف ثالث، ومن حقك أن تعرف بحدوثه. وقد يبلغ مئات الميغابايتات، فاستخدم شبكة Wi-Fi.',
    downloading: 'جارٍ تنزيل النموذج',
    downloadingNote: 'يحدث هذا مرة واحدة. ومغادرة الصفحة تلغيه.',
    checking: 'نتحقق مما يستطيعه متصفحك…',
    errorTitle: 'لم ينجح ذلك',
    retry: 'أعد المحاولة',
  },
}

export interface ModelGateProps {
  state: ModelState
  locale: Locale
  /** 0–1 while downloading. */
  progress?: number
  onDownload?: () => void
  onRetry?: () => void
  /** Shown instead of the built-in copy when a pair/language is unsupported. */
  unavailable?: ReactNode
  error?: string
}

export function ModelGate({ state, locale, progress = 0, onDownload, onRetry, unavailable, error }: ModelGateProps) {
  const s = STR[locale]

  if (state === 'available') return null

  if (state === 'checking') {
    return (
      <p className="flex items-center gap-2 text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="model-checking">
        <Spinner /> {s.checking}
      </p>
    )
  }

  if (state === 'unsupported') {
    return (
      <Panel className="gap-2" data-testid="model-unsupported">
        <h2 className="font-display text-[1.15rem] text-ink rtl:font-ar">{s.unsupportedTitle}</h2>
        <p className="text-[0.92rem] text-ink-soft rtl:font-ar">{s.unsupportedBody}</p>
        <p className="text-[0.92rem] text-ink-faint rtl:font-ar">{s.unsupportedWhyNot}</p>
      </Panel>
    )
  }

  if (state === 'unavailable') {
    return <Panel className="gap-2" data-testid="model-unavailable">{unavailable}</Panel>
  }

  if (state === 'downloading') {
    const pct = Math.round(progress * 100)
    return (
      <Panel className="gap-2" data-testid="model-downloading">
        <div className="flex items-center gap-2">
          <Spinner />
          <span className="text-[0.95rem] text-ink rtl:font-ar">{s.downloading}</span>
          <span className="font-mono text-[0.9rem] text-ink-faint ms-auto" data-testid="model-progress">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-sm bg-[color:var(--line)] overflow-hidden">
          <div className="h-full bg-green-600 transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.downloadingNote}</p>
      </Panel>
    )
  }

  if (state === 'error') {
    return (
      <Panel className="gap-2" data-testid="model-error">
        <h2 className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.errorTitle}</h2>
        {error && <p className="text-[0.9rem] text-ink-soft font-mono break-words">{error}</p>}
        {onRetry && <Button className="self-start" onClick={onRetry}>{s.retry}</Button>}
      </Panel>
    )
  }

  return (
    <Panel className="gap-2" data-testid="model-downloadable">
      <h2 className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.downloadableTitle}</h2>
      <p className="text-[0.88rem] text-ink-soft rtl:font-ar">{s.downloadNote}</p>
      <Button variant="primary" className="self-start" onClick={onDownload} data-testid="model-download">
        <DownloadIcon /> {s.download}
      </Button>
    </Panel>
  )
}
