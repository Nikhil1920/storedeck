import type { Faq } from './types'

export interface FaqSection {
  title: string
  items: Faq[]
}

export const FAQ: FaqSection[] = [
  {
    title: 'Using Storedeck',
    items: [
      { q: 'Is Storedeck free?', a: 'Yes. Storedeck is free and open source under the MIT license. There is no account, watermark or export limit.' },
      { q: 'Where are my projects and screenshots stored?', a: 'In your browser\'s IndexedDB storage on your device. Nothing is uploaded to a Storedeck server. Use **Export project file** to back up a project or move it to another browser.' },
      { q: 'Which stores and devices are supported?', a: 'App Store (iPhone, iPad, Mac, Apple TV, Apple Vision Pro, Apple Watch), Google Play (phone, 7" and 10" tablets, Chromebook, Android TV, Wear OS, Android XR, Automotive, feature graphic), Microsoft Store (Windows, Xbox), Steam (screenshots and capsules), Amazon Appstore (Fire TV, Fire tablet), generic smart-TV stores and web/social formats. See [screenshot sizes](/screenshot-sizes).' },
      { q: 'How are projects organized?', a: 'A **project** is one app. Inside it, **variants** are alternative screenshot sets for A/B tests. Each variant has one **platform** per store/device (iPhone, Android phone, Apple TV…), and every screen in a platform has copy and images per **language**.' },
      { q: 'Can I reuse my iPhone design for Android, iPad or TV?', a: 'Yes. When adding a platform, choose **Start from** an existing one. Screens, screenshots, copy and design are copied and rescaled to the new size — then drop in the device-specific captures.' },
      { q: 'Does it support 3D device mockups?', a: 'Phone platforms can switch to 3D models of the iPhone 15 Pro Max and Galaxy S25 Ultra with color finishes and drag-to-rotate. All platforms also have 2D frames: phone, tablet, watch, laptop, monitor, app window, browser and TV.' },
      { q: 'Can I import projects from the old Storedeck?', a: 'Yes. If projects from the previous version exist in the same browser, the editor offers to import them. Backup files exported from the old version can be imported from the project menu too.' },
    ],
  },
  {
    title: 'Localization',
    items: [
      { q: 'How do I add localized screenshots?', a: 'Name files with a language suffix — `home_de.png`, `home-fr.png`, `home_pt-br.png` — and drop them in. Files with the same base name become language versions of one screen.' },
      { q: 'What happens if a language is missing copy or an image?', a: 'Storedeck falls back to the default language (then other project languages), and the Board and Strings views highlight what is missing so you can fill the gaps.' },
      { q: 'Does it handle Arabic, Hebrew, Japanese and Indian languages?', a: 'Yes. Right-to-left languages render RTL with mirrored alignment, CJK and Thai wrap at word boundaries, and you can pick Google Fonts with the right script coverage (for example Noto Sans Telugu or Noto Sans JP).' },
    ],
  },
  {
    title: 'A/B testing',
    items: [
      { q: 'How do A/B variants work?', a: 'Click + next to the variant tabs to copy the current set. Change only what you are testing, record the hypothesis and status (control, testing, winner), compare variants side by side, and export each one for App Store Product Page Optimization or Google Play store listing experiments.' },
      { q: 'Does Storedeck run the experiment?', a: 'No — the stores run experiments on real traffic. Storedeck prepares, organizes and exports the variants. See the [A/B testing guide](/guides/ab-testing-store-screenshots).' },
    ],
  },
  {
    title: 'AI agents & WebMCP',
    items: [
      { q: 'Can an AI agent create screenshots for me?', a: 'Yes. Storedeck exposes 22 WebMCP tools that cover the whole editor, so a browser agent can upload captures, write and translate copy, style, review rendered previews and export — while you watch. See [for AI agents](/agents).' },
      { q: 'What is WebMCP?', a: 'WebMCP is a proposed web standard (W3C Web Machine Learning Community Group) that lets web pages expose tools to AI agents through `document.modelContext`. Storedeck registers its tools there when the browser supports it.' },
      { q: 'My agent cannot use WebMCP. Is there a fallback?', a: 'Yes. Every tool is also available as `window.storedeck.callTool(name, input)` for automation that can evaluate JavaScript in the page.' },
    ],
  },
  {
    title: 'Export',
    items: [
      { q: 'What formats can I export?', a: 'PNG or JPEG at the exact store size. Exports never contain transparency, because App Store Connect and Play Console reject alpha channels.' },
      { q: 'How are exported files organized?', a: 'The ZIP is laid out as `variant/platform-WIDTHxHEIGHT/language/01-screen-name.png` (the variant folder is included when you export more than one).' },
    ],
  },
]

export const ALL_FAQ = FAQ.flatMap(s => s.items)
