// Language catalog covering App Store Connect and Play Console listing locales.
// Codes are lower-case BCP-47 tags ("pt-br"), matching filename suffixes.

export interface LanguageInfo {
  code: string
  name: string
  native: string
  flag: string
  rtl?: boolean
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English (US)', native: 'English', flag: '🇺🇸' },
  { code: 'en-gb', name: 'English (UK)', native: 'English (UK)', flag: '🇬🇧' },
  { code: 'en-au', name: 'English (Australia)', native: 'English (AU)', flag: '🇦🇺' },
  { code: 'en-ca', name: 'English (Canada)', native: 'English (CA)', flag: '🇨🇦' },
  { code: 'en-in', name: 'English (India)', native: 'English (IN)', flag: '🇮🇳' },
  { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
  { code: 'fr-ca', name: 'French (Canada)', native: 'Français (CA)', flag: '🇨🇦' },
  { code: 'es', name: 'Spanish (Spain)', native: 'Español', flag: '🇪🇸' },
  { code: 'es-mx', name: 'Spanish (Mexico)', native: 'Español (MX)', flag: '🇲🇽' },
  { code: 'it', name: 'Italian', native: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese (Portugal)', native: 'Português', flag: '🇵🇹' },
  { code: 'pt-br', name: 'Portuguese (Brazil)', native: 'Português (BR)', flag: '🇧🇷' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', name: 'Swedish', native: 'Svenska', flag: '🇸🇪' },
  { code: 'da', name: 'Danish', native: 'Dansk', flag: '🇩🇰' },
  { code: 'no', name: 'Norwegian', native: 'Norsk', flag: '🇳🇴' },
  { code: 'fi', name: 'Finnish', native: 'Suomi', flag: '🇫🇮' },
  { code: 'pl', name: 'Polish', native: 'Polski', flag: '🇵🇱' },
  { code: 'cs', name: 'Czech', native: 'Čeština', flag: '🇨🇿' },
  { code: 'sk', name: 'Slovak', native: 'Slovenčina', flag: '🇸🇰' },
  { code: 'hu', name: 'Hungarian', native: 'Magyar', flag: '🇭🇺' },
  { code: 'ro', name: 'Romanian', native: 'Română', flag: '🇷🇴' },
  { code: 'hr', name: 'Croatian', native: 'Hrvatski', flag: '🇭🇷' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', flag: '🇹🇷' },
  { code: 'ru', name: 'Russian', native: 'Русский', flag: '🇷🇺' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська', flag: '🇺🇦' },
  { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'he', name: 'Hebrew', native: 'עברית', flag: '🇮🇱', rtl: true },
  { code: 'fa', name: 'Persian', native: 'فارسی', flag: '🇮🇷', rtl: true },
  { code: 'ur', name: 'Urdu', native: 'اردو', flag: '🇵🇰', rtl: true },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇧🇩' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'th', name: 'Thai', native: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'fil', name: 'Filipino', native: 'Filipino', flag: '🇵🇭' },
  { code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese (Simplified)', native: '简体中文', flag: '🇨🇳' },
  { code: 'zh-tw', name: 'Chinese (Traditional)', native: '繁體中文', flag: '🇹🇼' },
  { code: 'zh-hk', name: 'Chinese (Hong Kong)', native: '繁體中文 (香港)', flag: '🇭🇰' },
  { code: 'ca', name: 'Catalan', native: 'Català', flag: '🏳️' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili', flag: '🇰🇪' },
]

const byCode = new Map(LANGUAGES.map(l => [l.code, l]))

export function normalizeLang(code: string): string {
  return code.trim().toLowerCase().replace('_', '-')
}

export function isValidLangCode(code: unknown): code is string {
  if (typeof code !== 'string' || !code) return false
  const c = normalizeLang(code)
  return byCode.has(c) || /^[a-z]{2,3}(-[a-z0-9]{2,4})?$/.test(c)
}

export function getLanguage(code: string): LanguageInfo {
  const c = normalizeLang(code)
  return byCode.get(c) ?? { code: c, name: c.toUpperCase(), native: c.toUpperCase(), flag: '🏳️' }
}

export function isRtl(code: string): boolean {
  return !!byCode.get(normalizeLang(code))?.rtl
}

const suffixCodes = [...LANGUAGES.map(l => l.code)].sort((a, b) => b.length - a.length)

function suffixPattern(lang: string, tail: string): RegExp {
  const escaped = lang.replace('-', '[-_]?')
  return new RegExp(`[_-]${escaped}(?:[_-][a-z]{2})?${tail}`, 'i')
}

/** Detects "home_de.png", "home-pt-br.png", "home_de-DE.png" → language code. */
export function detectLanguageFromFilename(filename: string): string | null {
  for (const lang of suffixCodes) {
    if (suffixPattern(lang, '\\.[^.]+$').test(filename)) return lang
  }
  return null
}

/** "home_de.png" → "home"; used to group localized uploads onto one screen. */
export function baseFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, '')
  for (const lang of suffixCodes) {
    const pattern = suffixPattern(lang, '$')
    if (pattern.test(withoutExt)) return withoutExt.replace(pattern, '')
  }
  return withoutExt
}
