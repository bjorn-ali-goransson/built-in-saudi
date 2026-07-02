// Morning & evening adhkār — the core, universally-included set from the Qur'an
// and authentic Sunnah (public domain). Transliteration + English meaning are
// written for this app, not taken from any copyrighted translation. `when`:
// 'both' = said morning and evening. Counts follow the well-known narrations.
export type When = 'both' | 'morning' | 'evening'
export interface Dhikr {
  id: string
  ar: string
  translit: string
  en: string
  count: number
  ref: string
  when: When
}

export const ADHKAR: Dhikr[] = [
  {
    id: 'kursi',
    ar: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ، لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ، لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ، مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ، يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ، وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ، وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ، وَلَا يَئُودُهُ حِفْظُهُمَا، وَهُوَ الْعَلِيُّ الْعَظِيمُ.',
    translit: 'Allāhu lā ilāha illā huwa l-ḥayyu l-qayyūm… (Āyat al-Kursī, al-Baqarah 2:255)',
    en: 'Allah — there is no god but He, the Ever-Living, the Sustainer of all. Neither drowsiness nor sleep overtakes Him. To Him belongs whatever is in the heavens and the earth. Who could intercede with Him except by His leave? He knows what lies before them and behind them, while they grasp nothing of His knowledge except as He wills. His Throne encompasses the heavens and the earth, and their preservation does not weary Him. He is the Most High, the Most Great.',
    count: 1,
    ref: 'Qur’an — al-Baqarah 2:255 (Āyat al-Kursī)',
    when: 'both',
  },
  {
    id: 'ikhlas-muawwidhat',
    ar: 'قُلْ هُوَ اللَّهُ أَحَدٌ… ۞ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ… ۞ قُلْ أَعُوذُ بِرَبِّ النَّاسِ…',
    translit: 'Sūrat al-Ikhlāṣ, al-Falaq and an-Nās — recited in full, three times each.',
    en: 'Recite Sūrat al-Ikhlāṣ (112), al-Falaq (113) and an-Nās (114) in full — three times each. Whoever says them three times in the morning and evening, they suffice him against all things.',
    count: 3,
    ref: 'Abū Dāwūd & at-Tirmidhī',
    when: 'both',
  },
  {
    id: 'sayyid-istighfar',
    ar: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَىٰ عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ.',
    translit: 'Allāhumma anta rabbī lā ilāha illā ant, khalaqtanī wa anā ʿabduk… (Sayyid al-Istighfār)',
    en: 'O Allah, You are my Lord; there is no god but You. You created me and I am Your servant, and I keep Your covenant and pledge as best I can. I seek refuge in You from the evil I have done. I acknowledge Your favour upon me, and I acknowledge my sin — so forgive me, for none forgives sins but You.',
    count: 1,
    ref: 'Ṣaḥīḥ al-Bukhārī (the chief of seeking forgiveness)',
    when: 'both',
  },
  {
    id: 'asbahna-morning',
    ar: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ.',
    translit: 'Aṣbaḥnā wa aṣbaḥa l-mulku lillāh…',
    en: 'We have entered the morning and the whole kingdom belongs to Allah; all praise is to Allah. There is no god but Allah alone, with no partner; His is the dominion and His the praise, and He is able to do all things. My Lord, I ask You for the good of this day and the good after it, and I seek refuge in You from the evil of this day and the evil after it.',
    count: 1,
    ref: 'Ṣaḥīḥ Muslim',
    when: 'morning',
  },
  {
    id: 'amsayna-evening',
    ar: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ. رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا.',
    translit: 'Amsaynā wa amsā l-mulku lillāh…',
    en: 'We have entered the evening and the whole kingdom belongs to Allah; all praise is to Allah. There is no god but Allah alone, with no partner; His is the dominion and His the praise, and He is able to do all things. My Lord, I ask You for the good of this night and the good after it, and I seek refuge in You from the evil of this night and the evil after it.',
    count: 1,
    ref: 'Ṣaḥīḥ Muslim',
    when: 'evening',
  },
  {
    id: 'allahumma-bika-morning',
    ar: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ.',
    translit: 'Allāhumma bika aṣbaḥnā, wa bika amsaynā…',
    en: 'O Allah, by You we enter the morning and by You we enter the evening, by You we live and by You we die, and to You is the resurrection.',
    count: 1,
    ref: 'at-Tirmidhī',
    when: 'morning',
  },
  {
    id: 'allahumma-bika-evening',
    ar: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ.',
    translit: 'Allāhumma bika amsaynā, wa bika aṣbaḥnā…',
    en: 'O Allah, by You we enter the evening and by You we enter the morning, by You we live and by You we die, and to You is the final return.',
    count: 1,
    ref: 'at-Tirmidhī',
    when: 'evening',
  },
  {
    id: 'radhitu',
    ar: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا.',
    translit: 'Raḍītu billāhi rabbā, wa bil-islāmi dīnā, wa bi-Muḥammadin ﷺ nabiyyā.',
    en: 'I am content with Allah as Lord, with Islam as religion, and with Muhammad ﷺ as Prophet.',
    count: 3,
    ref: 'Abū Dāwūd & at-Tirmidhī',
    when: 'both',
  },
  {
    id: 'afini',
    ar: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَٰهَ إِلَّا أَنْتَ.',
    translit: 'Allāhumma ʿāfinī fī badanī, Allāhumma ʿāfinī fī samʿī, Allāhumma ʿāfinī fī baṣarī…',
    en: 'O Allah, grant my body well-being. O Allah, grant my hearing well-being. O Allah, grant my sight well-being. There is no god but You.',
    count: 3,
    ref: 'Abū Dāwūd',
    when: 'both',
  },
  {
    id: 'hasbiyallah',
    ar: 'حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ، وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ.',
    translit: 'Ḥasbiya-llāhu lā ilāha illā huwa, ʿalayhi tawakkaltu, wa huwa rabbu l-ʿarshi l-ʿaẓīm.',
    en: 'Allah is sufficient for me; there is no god but He. Upon Him I rely, and He is the Lord of the Mighty Throne.',
    count: 7,
    ref: 'Abū Dāwūd',
    when: 'both',
  },
  {
    id: 'bismillah-la-yadurr',
    ar: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ.',
    translit: 'Bismillāhi lladhī lā yaḍurru maʿa smihi shayʾun fī l-arḍi wa lā fī s-samāʾ, wa huwa s-samīʿu l-ʿalīm.',
    en: 'In the name of Allah, with whose name nothing on earth or in the heaven can cause harm, and He is the All-Hearing, the All-Knowing.',
    count: 3,
    ref: 'Abū Dāwūd & at-Tirmidhī',
    when: 'both',
  },
  {
    id: 'afwa-afiyah',
    ar: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي.',
    translit: 'Allāhumma innī asʾaluka l-ʿafwa wa l-ʿāfiyata fī d-dunyā wa l-ākhirah…',
    en: 'O Allah, I ask You for pardon and well-being in this world and the next. O Allah, I ask You for pardon and well-being in my religion, my worldly life, my family and my wealth.',
    count: 1,
    ref: 'Abū Dāwūd & Ibn Mājah',
    when: 'both',
  },
  {
    id: 'subhanallah-100',
    ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.',
    translit: 'Subḥāna-llāhi wa bi-ḥamdih.',
    en: 'Glory and praise be to Allah. (Whoever says it a hundred times in a day, his sins are wiped away though they were like the foam of the sea.)',
    count: 100,
    ref: 'al-Bukhārī & Muslim',
    when: 'both',
  },
  {
    id: 'tahlil-10',
    ar: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ.',
    translit: 'Lā ilāha illā-llāhu waḥdahu lā sharīka lah, lahu l-mulku wa lahu l-ḥamd, wa huwa ʿalā kulli shayʾin qadīr.',
    en: 'There is no god but Allah alone, with no partner. His is the dominion and His the praise, and He is able to do all things.',
    count: 10,
    ref: 'an-Nasāʾī & others (said ten times morning and evening)',
    when: 'both',
  },
  {
    id: 'kalimat-tammat',
    ar: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.',
    translit: 'Aʿūdhu bi-kalimāti-llāhi t-tāmmāti min sharri mā khalaq.',
    en: 'I seek refuge in the perfect words of Allah from the evil of what He has created.',
    count: 3,
    ref: 'Ṣaḥīḥ Muslim (said three times, especially in the evening)',
    when: 'evening',
  },
  {
    id: 'salat-nabi',
    ar: 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَىٰ نَبِيِّنَا مُحَمَّدٍ.',
    translit: 'Allāhumma ṣalli wa sallim ʿalā nabiyyinā Muḥammad.',
    en: 'O Allah, send blessings and peace upon our Prophet Muhammad.',
    count: 10,
    ref: 'aṭ-Ṭabarānī (whoever sends blessings ten times morning and evening attains the Prophet’s ﷺ intercession)',
    when: 'both',
  },
]
