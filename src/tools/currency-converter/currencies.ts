// Curated shortlist shown in the pickers (Gulf-first, then world majors). The
// rates API covers every ISO code, but a lean, Saudi-relevant list keeps the UI
// tidy and works offline. Codes are ISO-4217 (lowercased for the API).
export type Currency = { code: string; en: string; ar: string; sym: string }

export const CURRENCIES: Currency[] = [
  { code: 'SAR', en: 'Saudi Riyal', ar: 'ريال سعودي', sym: 'ر.س' },
  { code: 'USD', en: 'US Dollar', ar: 'دولار أمريكي', sym: '$' },
  { code: 'EUR', en: 'Euro', ar: 'يورو', sym: '€' },
  { code: 'GBP', en: 'British Pound', ar: 'جنيه إسترليني', sym: '£' },
  { code: 'AED', en: 'UAE Dirham', ar: 'درهم إماراتي', sym: 'د.إ' },
  { code: 'KWD', en: 'Kuwaiti Dinar', ar: 'دينار كويتي', sym: 'د.ك' },
  { code: 'BHD', en: 'Bahraini Dinar', ar: 'دينار بحريني', sym: 'د.ب' },
  { code: 'QAR', en: 'Qatari Riyal', ar: 'ريال قطري', sym: 'ر.ق' },
  { code: 'OMR', en: 'Omani Rial', ar: 'ريال عُماني', sym: 'ر.ع' },
  { code: 'EGP', en: 'Egyptian Pound', ar: 'جنيه مصري', sym: 'ج.م' },
  { code: 'JOD', en: 'Jordanian Dinar', ar: 'دينار أردني', sym: 'د.أ' },
  { code: 'TRY', en: 'Turkish Lira', ar: 'ليرة تركية', sym: '₺' },
  { code: 'INR', en: 'Indian Rupee', ar: 'روبية هندية', sym: '₹' },
  { code: 'PKR', en: 'Pakistani Rupee', ar: 'روبية باكستانية', sym: '₨' },
  { code: 'PHP', en: 'Philippine Peso', ar: 'بيزو فلبيني', sym: '₱' },
  { code: 'BDT', en: 'Bangladeshi Taka', ar: 'تاكا بنغلاديشية', sym: '৳' },
  { code: 'IDR', en: 'Indonesian Rupiah', ar: 'روبية إندونيسية', sym: 'Rp' },
  { code: 'JPY', en: 'Japanese Yen', ar: 'ين ياباني', sym: '¥' },
  { code: 'CNY', en: 'Chinese Yuan', ar: 'يوان صيني', sym: '¥' },
  { code: 'CAD', en: 'Canadian Dollar', ar: 'دولار كندي', sym: 'C$' },
  { code: 'AUD', en: 'Australian Dollar', ar: 'دولار أسترالي', sym: 'A$' },
  { code: 'CHF', en: 'Swiss Franc', ar: 'فرنك سويسري', sym: 'Fr' },
  { code: 'MYR', en: 'Malaysian Ringgit', ar: 'رينغيت ماليزي', sym: 'RM' },
  { code: 'ZAR', en: 'South African Rand', ar: 'راند جنوب إفريقي', sym: 'R' },
]

export const byCode = (c: string) => CURRENCIES.find((x) => x.code === c)
