// The rites of ʿUmrah and Ḥajj, step by step. The Arabic supplications are the
// public-domain Qur'ān/Sunnah texts; the transliteration and English meanings
// were written for this app, not taken from any copyrighted translation. The
// sequence follows the well-known Ḥajj at-Tamattuʿ (the form most non-residents
// perform), and every step is tagged by its fiqh ruling so a pilgrim can filter
// down to the essentials (arkān + wājibāt) or read the full guide with the
// recommended (sunnah) acts. Verify with a scholar before relying on it.

export type Rite = 'umrah' | 'hajj'
export type Level = 'obligatory' | 'recommended'

export interface Dua {
  ar: string
  translit: string
  en: string
}

export interface Step {
  id: string
  rite: Rite
  level: Level
  /** Short fiqh ruling shown as a badge. */
  tag: { en: string; ar: string }
  /** Optional day/phase heading, rendered when it changes. */
  phase?: { en: string; ar: string }
  title: { en: string; ar: string }
  body: { en: string; ar: string }
  /** A supplication tied to this step ("steps and prayers"). */
  dua?: Dua
}

const RUKN = { en: 'Pillar', ar: 'ركن' }
const WAJIB = { en: 'Obligation', ar: 'واجب' }
const SUNNAH = { en: 'Recommended', ar: 'سنة' }

export const STEPS: Step[] = [
  // ————————————————————————————————————— ʿUmrah —————————————————————————————————————
  {
    id: 'u-ghusl',
    rite: 'umrah',
    level: 'recommended',
    tag: SUNNAH,
    phase: { en: 'At the mīqāt', ar: 'عند الميقات' },
    title: { en: 'Prepare and make ghusl', ar: 'الاغتسال والتهيؤ' },
    body: {
      en: 'Before the mīqāt, bathe (ghusl) and — for men — apply perfume to the body, not to the garments. Men then wear the two white unstitched cloths (izār and ridāʾ); women wear ordinary modest clothing without a face-veil or gloves.',
      ar: 'قبل الميقات اغتسل، ويتطيّب الرجل في بدنه لا في ثوبي إحرامه. ثم يلبس الرجل إزارًا ورداءً أبيضين، وتلبس المرأة ثيابها المعتادة الساترة من غير نقاب ولا قفّازين.',
    },
  },
  {
    id: 'u-ihram',
    rite: 'umrah',
    level: 'obligatory',
    tag: RUKN,
    phase: { en: 'At the mīqāt', ar: 'عند الميقات' },
    title: { en: 'Enter iḥrām at the mīqāt', ar: 'الإحرام من الميقات' },
    body: {
      en: 'At the mīqāt, form the intention (niyyah) to begin ʿUmrah and enter the state of iḥrām — you may not pass the mīqāt without it. From now until you touch the Black Stone, avoid the prohibitions of iḥrām (cutting hair or nails, perfume, hunting, intimacy).',
      ar: 'عند الميقات انوِ الدخول في نسك العمرة وأحرم — ولا يجوز تجاوز الميقات بلا إحرام. ومن الآن إلى استلام الحجر اجتنب محظورات الإحرام (قصّ الشعر والأظفار والطيب والصيد والجماع).',
    },
    dua: {
      ar: 'لَبَّيْكَ اللَّهُمَّ عُمْرَةً',
      translit: 'Labbayk Allāhumma ʿumrah',
      en: 'Here I am, O Allah, for ʿUmrah.',
    },
  },
  {
    id: 'u-talbiyah',
    rite: 'umrah',
    level: 'recommended',
    tag: SUNNAH,
    phase: { en: 'At the mīqāt', ar: 'عند الميقات' },
    title: { en: 'Recite the talbiyah', ar: 'التلبية' },
    body: {
      en: 'Repeat the talbiyah often from the moment you enter iḥrām until you reach the Black Stone to begin ṭawāf; men raise their voices with it.',
      ar: 'أكثِر من التلبية من حين إحرامك إلى أن تصل الحجر الأسود لبدء الطواف؛ ويرفع الرجال أصواتهم بها.',
    },
    dua: {
      ar: 'لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ، لَا شَرِيكَ لَكَ.',
      translit: 'Labbayk Allāhumma labbayk, labbayka lā sharīka laka labbayk, inna l-ḥamda wa n-niʿmata laka wa l-mulk, lā sharīka lak.',
      en: 'Here I am, O Allah, here I am. Here I am, You have no partner, here I am. All praise, grace and dominion are Yours; You have no partner.',
    },
  },
  {
    id: 'u-enter',
    rite: 'umrah',
    level: 'recommended',
    tag: SUNNAH,
    phase: { en: 'At the Masjid al-Ḥarām', ar: 'في المسجد الحرام' },
    title: { en: 'Enter the Masjid al-Ḥarām', ar: 'دخول المسجد الحرام' },
    body: {
      en: 'Enter with your right foot and say the du‘ā for entering the mosque.',
      ar: 'ادخل بقدمك اليمنى وقل دعاء دخول المسجد.',
    },
    dua: {
      ar: 'بِسْمِ اللَّهِ، وَالصَّلَاةُ وَالسَّلَامُ عَلَىٰ رَسُولِ اللَّهِ، اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ.',
      translit: 'Bismillāh, waṣ-ṣalātu was-salāmu ʿalā rasūlillāh. Allāhumma-ftaḥ lī abwāba raḥmatik.',
      en: 'In the name of Allah; peace and blessings be upon the Messenger of Allah. O Allah, open for me the gates of Your mercy.',
    },
  },
  {
    id: 'u-tawaf',
    rite: 'umrah',
    level: 'obligatory',
    tag: RUKN,
    phase: { en: 'At the Masjid al-Ḥarām', ar: 'في المسجد الحرام' },
    title: { en: 'Ṭawāf — seven circuits', ar: 'الطواف — سبعة أشواط' },
    body: {
      en: 'Circle the Kaʿbah seven times anticlockwise, beginning and ending at the Black Stone — kiss it, touch it, or point to it with your right hand saying “Allāhu akbar” at the start of each circuit. Men bare the right shoulder (iḍṭibāʿ) and walk briskly (raml) in the first three circuits. Between the Yemeni Corner and the Black Stone say the du‘ā below; supplicate freely otherwise.',
      ar: 'طُف بالكعبة سبعة أشواط عكس عقارب الساعة، تبدأ وتختم عند الحجر الأسود — تُقبّله أو تستلمه أو تشير إليه بيمينك قائلًا «الله أكبر» في بداية كل شوط. ويكشف الرجل كتفه الأيمن (الاضطباع) ويرمُل في الأشواط الثلاثة الأولى. وبين الركن اليماني والحجر قل الدعاء الآتي، وادعُ بما شئت في سائره.',
    },
    dua: {
      ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ.',
      translit: 'Rabbanā ātinā fī d-dunyā ḥasanah wa fī l-ākhirati ḥasanah wa qinā ʿadhāba n-nār.',
      en: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.',
    },
  },
  {
    id: 'u-maqam',
    rite: 'umrah',
    level: 'recommended',
    tag: SUNNAH,
    phase: { en: 'At the Masjid al-Ḥarām', ar: 'في المسجد الحرام' },
    title: { en: 'Two rakʿahs at the Maqām', ar: 'ركعتان عند المقام' },
    body: {
      en: 'After ṭawāf, pray two rakʿahs behind the Maqām of Ibrāhīm if you can, otherwise anywhere in the mosque — reciting Sūrat al-Kāfirūn in the first and al-Ikhlāṣ in the second.',
      ar: 'بعد الطواف صلِّ ركعتين خلف مقام إبراهيم إن تيسّر، وإلا ففي أي موضع من المسجد — تقرأ في الأولى سورة الكافرون وفي الثانية الإخلاص.',
    },
  },
  {
    id: 'u-zamzam',
    rite: 'umrah',
    level: 'recommended',
    tag: SUNNAH,
    phase: { en: 'At the Masjid al-Ḥarām', ar: 'في المسجد الحرام' },
    title: { en: 'Drink Zamzam', ar: 'شرب ماء زمزم' },
    body: {
      en: 'Drink your fill of Zamzam and pour some over your head, supplicating for whatever you wish — “the water of Zamzam is for whatever it is drunk for.”',
      ar: 'اشرب من ماء زمزم وصبَّ على رأسك، وادعُ بما شئت — «ماء زمزم لِما شُرِب له».',
    },
  },
  {
    id: 'u-saee',
    rite: 'umrah',
    level: 'obligatory',
    tag: RUKN,
    phase: { en: 'At Ṣafā & Marwah', ar: 'بين الصفا والمروة' },
    title: { en: 'Saʿy between Ṣafā and Marwah', ar: 'السعي بين الصفا والمروة' },
    body: {
      en: 'Go to Ṣafā; as you approach recite the verse below. Climb it facing the Kaʿbah, raise your hands and proclaim the tahlīl and takbīr three times with du‘ā between. Then walk to Marwah — men jog between the two green markers — completing seven trips (Ṣafā→Marwah is one), ending at Marwah.',
      ar: 'اذهب إلى الصفا، وعند اقترابك اقرأ الآية الآتية. ارقَ عليه مستقبلًا الكعبة وارفع يديك وكبّر وهلّل ثلاثًا وادعُ بينها. ثم امشِ إلى المروة — ويسعى الرجل بين العلمين الأخضرين — حتى تُتمّ سبعة أشواط (من الصفا إلى المروة شوط)، وتختم بالمروة.',
    },
    dua: {
      ar: 'إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَائِرِ اللَّهِ… أَبْدَأُ بِمَا بَدَأَ اللَّهُ بِهِ.',
      translit: 'Inna ṣ-ṣafā wa l-marwata min shaʿāʾirillāh… abdaʾu bimā badaʾa llāhu bih.',
      en: 'Indeed Ṣafā and Marwah are among the symbols of Allah… I begin with what Allah began with. (al-Baqarah 2:158)',
    },
  },
  {
    id: 'u-halq',
    rite: 'umrah',
    level: 'obligatory',
    tag: WAJIB,
    phase: { en: 'Completing ʿUmrah', ar: 'إتمام العمرة' },
    title: { en: 'Shave or trim the hair', ar: 'الحلق أو التقصير' },
    body: {
      en: 'Men shave the whole head (ḥalq — more rewarded) or trim it evenly (taqṣīr); women gather their hair and trim a fingertip’s length. With this your ʿUmrah is complete and the restrictions of iḥrām are lifted.',
      ar: 'يحلق الرجل رأسه كله (والحلق أفضل) أو يقصّره من جميع جوانبه؛ وتقصّر المرأة قدر أنملة من شعرها. وبهذا تتمّ العمرة وتحلّ محظورات الإحرام.',
    },
  },

  // ————————————————————————————————————— Ḥajj —————————————————————————————————————
  {
    id: 'h-ihram',
    rite: 'hajj',
    level: 'obligatory',
    tag: RUKN,
    phase: { en: '8 Dhū al-Ḥijjah — Yawm at-Tarwiyah', ar: '٨ ذو الحجة — يوم التروية' },
    title: { en: 'Enter iḥrām for Ḥajj', ar: 'الإحرام بالحج' },
    body: {
      en: 'On the morning of the 8th, make ghusl, put on iḥrām, and form the intention for Ḥajj — for tamattuʿ, from your lodging in Makkah. Then begin the talbiyah of Ḥajj.',
      ar: 'صباح الثامن اغتسل والبس الإحرام وانوِ الحج — والمتمتّع يُحرم من مكانه في مكة. ثم لبِّ بالحج.',
    },
    dua: {
      ar: 'لَبَّيْكَ اللَّهُمَّ حَجًّا',
      translit: 'Labbayk Allāhumma ḥajjā',
      en: 'Here I am, O Allah, for Ḥajj.',
    },
  },
  {
    id: 'h-mina1',
    rite: 'hajj',
    level: 'recommended',
    tag: SUNNAH,
    phase: { en: '8 Dhū al-Ḥijjah — Yawm at-Tarwiyah', ar: '٨ ذو الحجة — يوم التروية' },
    title: { en: 'Go to Minā', ar: 'التوجّه إلى منى' },
    body: {
      en: 'Head to Minā and pray Ẓuhr, ʿAṣr, Maghrib, ʿIshāʾ and the next Fajr there — each four-unit prayer shortened to two (qaṣr) but not combined — staying the night of the 8th.',
      ar: 'اذهب إلى منى وصلِّ بها الظهر والعصر والمغرب والعشاء وفجر التاسع — تقصر الرباعية إلى ركعتين من غير جمع — وبِت بها ليلة الثامن.',
    },
  },
  {
    id: 'h-arafah',
    rite: 'hajj',
    level: 'obligatory',
    tag: RUKN,
    phase: { en: '9 Dhū al-Ḥijjah — Yawm ʿArafah', ar: '٩ ذو الحجة — يوم عرفة' },
    title: { en: 'Stand at ʿArafah', ar: 'الوقوف بعرفة' },
    body: {
      en: 'After sunrise move towards ʿArafah. From the sun’s zenith combine and shorten Ẓuhr and ʿAṣr (two units each), then devote the afternoon to du‘ā and dhikr facing the qiblah with raised hands until sunset. “Ḥajj is ʿArafah.” Remaining until sunset is obligatory.',
      ar: 'بعد شروق التاسع اتجه إلى عرفة. ومن الزوال اجمع واقصر الظهر والعصر (ركعتين ركعتين)، ثم اجتهد بقية النهار بالدعاء والذكر مستقبلًا القبلة رافعًا يديك إلى الغروب. «الحج عرفة». والبقاء إلى الغروب واجب.',
    },
    dua: {
      ar: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ.',
      translit: 'Lā ilāha illā llāhu waḥdahu lā sharīka lah, lahu l-mulku wa lahu l-ḥamd, wa huwa ʿalā kulli shayʾin qadīr.',
      en: 'There is no god but Allah alone, with no partner; His is the dominion and His the praise, and He is able to do all things. (the best du‘ā of ʿArafah)',
    },
  },
  {
    id: 'h-muzdalifah',
    rite: 'hajj',
    level: 'obligatory',
    tag: WAJIB,
    phase: { en: 'Night of the 10th — Muzdalifah', ar: 'ليلة العاشر — مزدلفة' },
    title: { en: 'Night at Muzdalifah', ar: 'المبيت بمزدلفة' },
    body: {
      en: 'After sunset go to Muzdalifah — do not pray Maghrib on the way — and there pray Maghrib and ʿIshāʾ combined (Maghrib three units, ʿIshāʾ two). Stay the night; the weak and women may leave after midnight. Pray Fajr early, supplicate, and gather pebbles for the stoning.',
      ar: 'بعد الغروب اذهب إلى مزدلفة — ولا تصلِّ المغرب في الطريق — وصلِّ بها المغرب والعشاء جمعًا (المغرب ثلاثًا والعشاء ركعتين). وبِت بها، ويجوز للضعفة والنساء الدفع بعد منتصف الليل. صلِّ الفجر مبكرًا وادعُ، والتقط حصى الجمار.',
    },
  },
  {
    id: 'h-jamra-aqaba',
    rite: 'hajj',
    level: 'obligatory',
    tag: WAJIB,
    phase: { en: '10 Dhū al-Ḥijjah — Yawm an-Naḥr', ar: '١٠ ذو الحجة — يوم النحر' },
    title: { en: 'Stone Jamrat al-ʿAqabah', ar: 'رمي جمرة العقبة' },
    body: {
      en: 'On the morning of the 10th go to the large Jamrah (al-ʿAqabah) and throw seven pebbles one by one, saying “Allāhu akbar” with each. Stop the talbiyah as you throw the first pebble.',
      ar: 'صباح العاشر ارمِ جمرة العقبة الكبرى بسبع حصيات واحدة تلو الأخرى، مكبّرًا مع كل حصاة. وتقطع التلبية مع أول حصاة.',
    },
  },
  {
    id: 'h-hady',
    rite: 'hajj',
    level: 'obligatory',
    tag: WAJIB,
    phase: { en: '10 Dhū al-Ḥijjah — Yawm an-Naḥr', ar: '١٠ ذو الحجة — يوم النحر' },
    title: { en: 'Offer the sacrifice (hady)', ar: 'ذبح الهدي' },
    body: {
      en: 'Those performing tamattuʿ or qirān offer a sacrifice — usually arranged through a licensed agency — in gratitude for joining the two rites.',
      ar: 'يذبح المتمتّع والقارن هديًا — غالبًا عبر جهة مرخّصة — شكرًا للجمع بين النسكين.',
    },
  },
  {
    id: 'h-halq',
    rite: 'hajj',
    level: 'obligatory',
    tag: WAJIB,
    phase: { en: '10 Dhū al-Ḥijjah — Yawm an-Naḥr', ar: '١٠ ذو الحجة — يوم النحر' },
    title: { en: 'Shave or trim the hair', ar: 'الحلق أو التقصير' },
    body: {
      en: 'Men shave (ḥalq — more rewarded) or trim (taqṣīr); women trim a fingertip’s length. After stoning and shaving comes the first release (at-taḥallul al-awwal): everything becomes lawful again except intimacy with one’s spouse.',
      ar: 'يحلق الرجل (والحلق أفضل) أو يقصّر؛ وتقصّر المرأة قدر أنملة. وبعد الرمي والحلق يحصل التحلّل الأول: فيحلّ كل شيء إلا الجماع.',
    },
  },
  {
    id: 'h-ifadah',
    rite: 'hajj',
    level: 'obligatory',
    tag: RUKN,
    phase: { en: '10 Dhū al-Ḥijjah — Yawm an-Naḥr', ar: '١٠ ذو الحجة — يوم النحر' },
    title: { en: 'Ṭawāf al-Ifāḍah and Saʿy', ar: 'طواف الإفاضة والسعي' },
    body: {
      en: 'Go to the Kaʿbah for Ṭawāf al-Ifāḍah — a pillar of Ḥajj — followed by saʿy between Ṣafā and Marwah (for tamattuʿ). With this comes the final release (at-taḥallul ath-thānī) and every restriction lifts. It may be delayed into the days of Minā.',
      ar: 'اذهب إلى الكعبة لطواف الإفاضة — وهو ركن الحج — يليه السعي بين الصفا والمروة (للمتمتّع). وبه يحصل التحلّل الثاني فيحلّ كل شيء. ويجوز تأخيره إلى أيام منى.',
    },
  },
  {
    id: 'h-mina-nights',
    rite: 'hajj',
    level: 'obligatory',
    tag: WAJIB,
    phase: { en: '11–13 Dhū al-Ḥijjah — Ayyām at-Tashrīq', ar: '١١–١٣ ذو الحجة — أيام التشريق' },
    title: { en: 'Nights and stoning at Minā', ar: 'المبيت والرمي بمنى' },
    body: {
      en: 'Spend the nights of the 11th, 12th (and 13th) at Minā. Each day, after the sun passes its zenith, stone the three Jamarāt in order — the small (aṣ-Ṣughrā), then the middle (al-Wusṭā), then the large (al-ʿAqabah) — seven pebbles at each with takbīr.',
      ar: 'بِت ليالي الحادي عشر والثاني عشر (والثالث عشر) بمنى. وارمِ كل يوم بعد الزوال الجمرات الثلاث بالترتيب — الصغرى ثم الوسطى ثم الكبرى — سبع حصيات لكل جمرة مع التكبير.',
    },
  },
  {
    id: 'h-tashriq-dua',
    rite: 'hajj',
    level: 'recommended',
    tag: SUNNAH,
    phase: { en: '11–13 Dhū al-Ḥijjah — Ayyām at-Tashrīq', ar: '١١–١٣ ذو الحجة — أيام التشريق' },
    title: { en: 'Supplicate after the first two Jamarāt', ar: 'الدعاء بعد الجمرتين' },
    body: {
      en: 'After stoning the small Jamrah and again after the middle one, step aside, face the qiblah and make long du‘ā with raised hands. There is no standing for du‘ā after the large Jamrah.',
      ar: 'بعد رمي الجمرة الصغرى ثم الوسطى، تنحَّ واستقبل القبلة وأطِل الدعاء رافعًا يديك. ولا وقوف للدعاء بعد الجمرة الكبرى.',
    },
  },
  {
    id: 'h-nafr',
    rite: 'hajj',
    level: 'recommended',
    tag: SUNNAH,
    phase: { en: '11–13 Dhū al-Ḥijjah — Ayyām at-Tashrīq', ar: '١١–١٣ ذو الحجة — أيام التشريق' },
    title: { en: 'Leaving Minā (12th or 13th)', ar: 'النفر من منى' },
    body: {
      en: 'You may hasten and leave after stoning on the 12th before sunset (an-nafr al-awwal), or stay for the 13th and stone once more (an-nafr ath-thānī) — staying the extra day is better.',
      ar: 'يجوز أن تتعجّل فتنفر بعد رمي الثاني عشر قبل الغروب (النفر الأول)، أو تبقى للثالث عشر وترمي (النفر الثاني) — والبقاء أفضل.',
    },
  },
  {
    id: 'h-wada',
    rite: 'hajj',
    level: 'obligatory',
    tag: WAJIB,
    phase: { en: 'Before leaving Makkah', ar: 'قبل مغادرة مكة' },
    title: { en: 'Farewell Ṭawāf (al-Wadāʿ)', ar: 'طواف الوداع' },
    body: {
      en: 'Before leaving Makkah, make a farewell ṭawāf of seven circuits so that the last of your acts is at the House. It is waived for a menstruating woman.',
      ar: 'قبل مغادرة مكة طُف طواف الوداع سبعة أشواط ليكون آخر عهدك بالبيت. ويسقط عن الحائض.',
    },
  },
]
