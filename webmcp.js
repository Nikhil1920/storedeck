// WebMCP Tools for AppScreen — Translation Management
// Exposes screenshot text & language management to AI agents (ChatGPT, Claude, etc.)
// Spec: https://webmachinelearning.github.io/webmcp/
// ChatGPT docs: https://learn.chatgpt.com/docs/webmcp

// All tools are imperative, top-level, narrow, and reuse existing state helpers.
// No external LLM calls — the agent itself generates translations and writes via tools.

(function() {
  'use strict';

  // Guards: ensure required globals exist (state, languageNames/flags, helpers)
  function hasRequiredGlobals() {
    return typeof state !== 'undefined'
      && typeof languageNames !== 'undefined'
      && typeof languageFlags !== 'undefined';
  }

  function isLanguageCodeValid(code) {
    // Allow codes present in languageFlags or languageNames, or simple BCP-47 pattern
    if (languageFlags[code] || languageNames[code]) return true;
    // Fallback: accept xx or xx-yy
    return /^[a-z]{2}(-[a-z]{2})?$/i.test(code);
  }

  function ensureScreenshotTextStructure(screenshot) {
    if (!screenshot.text) screenshot.text = JSON.parse(JSON.stringify(baseTextDefaults || normalizeTextSettings(null)));
    // Normalize to ensure headlines/subheadlines exist
    if (typeof normalizeTextSettings === 'function') {
      screenshot.text = normalizeTextSettings(screenshot.text);
    } else {
      screenshot.text.headlines = screenshot.text.headlines || { en: '' };
      screenshot.text.subheadlines = screenshot.text.subheadlines || { en: '' };
      screenshot.text.headlineLanguages = screenshot.text.headlineLanguages || Object.keys(screenshot.text.headlines);
      screenshot.text.subheadlineLanguages = screenshot.text.subheadlineLanguages || Object.keys(screenshot.text.subheadlines);
    }
    return screenshot.text;
  }

  function getToolsDefinitions() {
    return [
      {
        name: 'list_languages',
        description: 'List all project languages, current language, and available language metadata. Use this to discover which languages exist and what the language names/flags are.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async () => {
          return {
            projectLanguages: [...state.projectLanguages],
            currentLanguage: state.currentLanguage,
            names: { ...languageNames },
            flags: { ...languageFlags }
          };
        }
      },
      {
        name: 'list_screenshots',
        description: 'List all screenshots with their per-language headlines and subheadlines. Use to see which texts need translation and to find source text. Does NOT include image data.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async () => {
          return state.screenshots.map((s, i) => {
            const text = s.text || state.defaults?.text || {};
            const headlines = text.headlines || {};
            const subheadlines = text.subheadlines || {};
            // Determine missing languages (projectLanguages that have no headline)
            const missing = state.projectLanguages.filter(lang => !headlines[lang]?.trim() && !subheadlines[lang]?.trim());
            return {
              index: i,
              name: s.name || `Screenshot ${i + 1}`,
              deviceType: s.deviceType || 'unknown',
              headlines: { ...headlines },
              subheadlines: { ...subheadlines },
              headlineLanguages: text.headlineLanguages ? [...text.headlineLanguages] : Object.keys(headlines),
              subheadlineLanguages: text.subheadlineLanguages ? [...text.subheadlineLanguages] : Object.keys(subheadlines),
              missingLanguages: missing
            };
          });
        }
      },
      {
        name: 'get_screenshot_texts',
        description: 'Get detailed headline and subheadline texts for a specific screenshot across all languages.',
        inputSchema: {
          type: 'object',
          properties: {
            screenshotIndex: { type: 'integer', minimum: 0, description: '0-based index of the screenshot' }
          },
          required: ['screenshotIndex'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async ({ screenshotIndex }) => {
          const s = state.screenshots[screenshotIndex];
          if (!s) throw new Error(`Screenshot index ${screenshotIndex} out of range (0-${state.screenshots.length - 1})`);
          const text = ensureScreenshotTextStructure(s);
          return {
            index: screenshotIndex,
            name: s.name,
            headlines: { ...text.headlines },
            subheadlines: { ...text.subheadlines },
            headlineEnabled: text.headlineEnabled,
            subheadlineEnabled: text.subheadlineEnabled,
            headlineLanguages: [...(text.headlineLanguages || [])],
            subheadlineLanguages: [...(text.subheadlineLanguages || [])],
            currentHeadlineLang: text.currentHeadlineLang,
            currentSubheadlineLang: text.currentSubheadlineLang,
            perLanguageLayout: !!text.perLanguageLayout
          };
        }
      },
      {
        name: 'set_screenshot_text',
        description: 'Set the headline or subheadline text for a specific screenshot and language. Creates the language entry if it does not exist. Call syncs UI, canvas, and saves state.',
        inputSchema: {
          type: 'object',
          properties: {
            screenshotIndex: { type: 'integer', minimum: 0, description: '0-based screenshot index' },
            kind: { type: 'string', enum: ['headline', 'subheadline'], description: 'Which text field to update' },
            language: { type: 'string', description: "BCP-47 language code e.g. 'de', 'fr', 'pt-br'" },
            text: { type: 'string', description: 'Translated text (keep similar length to source, max 500 chars)' }
          },
          required: ['screenshotIndex', 'kind', 'language', 'text'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async ({ screenshotIndex, kind, language, text }, { signal }) => {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          if (screenshotIndex < 0 || screenshotIndex >= state.screenshots.length) {
            throw new Error(`Invalid screenshotIndex ${screenshotIndex}`);
          }
          if (!isLanguageCodeValid(language)) {
            throw new Error(`Invalid language code: ${language}`);
          }
          if (typeof text !== 'string') throw new Error('text must be a string');
          if (text.length > 500) throw new Error('text too long (max 500 chars)');

          const s = state.screenshots[screenshotIndex];
          const t = ensureScreenshotTextStructure(s);

          if (kind === 'headline') {
            t.headlines[language] = text;
            if (!t.headlineLanguages.includes(language)) t.headlineLanguages.push(language);
            t.currentHeadlineLang = language;
            t.headlineEnabled = true;
            // Ensure language is in projectLanguages
            if (!state.projectLanguages.includes(language) && typeof addProjectLanguage === 'function') {
              addProjectLanguage(language);
            }
          } else {
            t.subheadlines[language] = text;
            if (!t.subheadlineLanguages.includes(language)) t.subheadlineLanguages.push(language);
            t.currentSubheadlineLang = language;
            if (text.trim()) t.subheadlineEnabled = true;
            if (!state.projectLanguages.includes(language) && typeof addProjectLanguage === 'function') {
              addProjectLanguage(language);
            }
          }

          if (typeof syncUIWithState === 'function') syncUIWithState();
          if (typeof updateCanvas === 'function') updateCanvas();
          if (typeof saveState === 'function') await saveState();

          return {
            success: true,
            screenshotIndex,
            kind,
            language,
            textPreview: text.substring(0, 80)
          };
        }
      },
      {
        name: 'set_bulk_translations',
        description: 'Batch set many headline/subheadline translations at once. Generate translations yourself first, then call this tool with all translations. Prefer this over many single calls.',
        inputSchema: {
          type: 'object',
          properties: {
            translations: {
              type: 'array',
              description: 'Array of translation entries',
              minItems: 1,
              items: {
                type: 'object',
                properties: {
                  screenshotIndex: { type: 'integer', minimum: 0 },
                  kind: { type: 'string', enum: ['headline', 'subheadline'] },
                  language: { type: 'string' },
                  text: { type: 'string' }
                },
                required: ['screenshotIndex', 'kind', 'language', 'text'],
                additionalProperties: false
              }
            }
          },
          required: ['translations'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async ({ translations }, { signal }) => {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          if (!Array.isArray(translations) || translations.length === 0) {
            throw new Error('translations must be a non-empty array');
          }
          if (translations.length > 200) {
            throw new Error('Too many translations at once (max 200)');
          }

          let applied = 0;
          const errors = [];
          const touchedLanguages = new Set();

          for (let i = 0; i < translations.length; i++) {
            if (signal?.aborted) break;
            const entry = translations[i];
            const s = state.screenshots[entry.screenshotIndex];
            if (!s) {
              errors.push(`index ${entry.screenshotIndex} out of range at position ${i}`);
              continue;
            }
            if (!isLanguageCodeValid(entry.language)) {
              errors.push(`invalid language ${entry.language} at position ${i}`);
              continue;
            }
            if (typeof entry.text !== 'string' || entry.text.length > 500) {
              errors.push(`invalid text at position ${i}`);
              continue;
            }

            const t = ensureScreenshotTextStructure(s);
            if (entry.kind === 'headline') {
              t.headlines[entry.language] = entry.text;
              if (!t.headlineLanguages.includes(entry.language)) t.headlineLanguages.push(entry.language);
              t.headlineEnabled = true;
            } else {
              t.subheadlines[entry.language] = entry.text;
              if (!t.subheadlineLanguages.includes(entry.language)) t.subheadlineLanguages.push(entry.language);
              if (entry.text.trim()) t.subheadlineEnabled = true;
            }
            touchedLanguages.add(entry.language);
            applied++;
          }

          // Add any new languages to projectLanguages
          for (const lang of touchedLanguages) {
            if (!state.projectLanguages.includes(lang) && typeof addProjectLanguage === 'function') {
              addProjectLanguage(lang);
            }
          }

          if (typeof syncUIWithState === 'function') syncUIWithState();
          if (typeof updateCanvas === 'function') updateCanvas();
          if (typeof saveState === 'function') await saveState();

          const result = { applied, total: translations.length };
          if (errors.length) result.errors = errors;
          if (signal?.aborted) result.aborted = true;
          return result;
        }
      },
      {
        name: 'add_project_language',
        description: 'Add a new language to the project. Future screenshots and translations will include this language.',
        inputSchema: {
          type: 'object',
          properties: {
            language: { type: 'string', description: "Language code e.g. 'de', 'pt-br'" }
          },
          required: ['language'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async ({ language }, { signal }) => {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          if (!isLanguageCodeValid(language)) throw new Error(`Invalid language code: ${language}`);
          if (state.projectLanguages.includes(language)) {
            return { success: true, alreadyExisted: true, language, projectLanguages: [...state.projectLanguages] };
          }
          if (typeof addProjectLanguage === 'function') {
            addProjectLanguage(language);
            if (typeof saveState === 'function') await saveState();
            return { success: true, language, projectLanguages: [...state.projectLanguages] };
          }
          throw new Error('addProjectLanguage not available');
        }
      },
      {
        name: 'remove_project_language',
        description: 'Remove a language from the project. Keeps existing texts but removes the language from the active list.',
        inputSchema: {
          type: 'object',
          properties: {
            language: { type: 'string' }
          },
          required: ['language'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async ({ language }, { signal }) => {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          if (!state.projectLanguages.includes(language)) {
            return { success: true, alreadyMissing: true, language };
          }
          if (state.projectLanguages.length <= 1) {
            throw new Error('Cannot remove the last language');
          }
          if (typeof removeProjectLanguage === 'function') {
            removeProjectLanguage(language);
            if (typeof saveState === 'function') await saveState();
            return { success: true, language, projectLanguages: [...state.projectLanguages] };
          }
          // Fallback inline
          state.projectLanguages = state.projectLanguages.filter(l => l !== language);
          if (state.currentLanguage === language) state.currentLanguage = state.projectLanguages[0];
          if (typeof syncUIWithState === 'function') syncUIWithState();
          if (typeof updateCanvas === 'function') updateCanvas();
          if (typeof saveState === 'function') await saveState();
          return { success: true, language, projectLanguages: [...state.projectLanguages] };
        }
      },
      {
        name: 'get_element_texts',
        description: 'List all graphic/text elements for the currently selected screenshot and their per-language texts.',
        inputSchema: {
          type: 'object',
          properties: {
            screenshotIndex: { type: 'integer', minimum: 0, description: 'Optional screenshot index; defaults to currently selected' }
          },
          additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async ({ screenshotIndex } = {}) => {
          const idx = typeof screenshotIndex === 'number' ? screenshotIndex : state.selectedIndex;
          const s = state.screenshots[idx];
          if (!s) throw new Error(`Invalid screenshotIndex ${idx}`);
          const elements = s.elements || [];
          return {
            screenshotIndex: idx,
            elements: elements.map(el => ({
              id: el.id,
              type: el.type,
              name: el.name,
              texts: el.texts ? { ...el.texts } : undefined,
              text: el.text || ''
            }))
          };
        }
      },
      {
        name: 'set_element_text',
        description: "Set the text for a graphic/text element in a specific language.",
        inputSchema: {
          type: 'object',
          properties: {
            elementId: { type: 'string', description: 'Element ID from get_element_texts' },
            language: { type: 'string' },
            text: { type: 'string' },
            screenshotIndex: { type: 'integer', minimum: 0, description: 'Optional; defaults to selected screenshot' }
          },
          required: ['elementId', 'language', 'text'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async ({ elementId, language, text, screenshotIndex }, { signal }) => {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          const idx = typeof screenshotIndex === 'number' ? screenshotIndex : state.selectedIndex;
          const s = state.screenshots[idx];
          if (!s) throw new Error(`Invalid screenshotIndex ${idx}`);
          const el = (s.elements || []).find(e => e.id === elementId);
          if (!el) throw new Error(`Element ${elementId} not found`);
          if (!isLanguageCodeValid(language)) throw new Error(`Invalid language ${language}`);
          if (!el.texts) el.texts = {};
          el.texts[language] = text;
          // Keep el.text in sync with currentLanguage
          if (typeof getElementText === 'function') el.text = getElementText(el);
          else el.text = text;
          if (!state.projectLanguages.includes(language) && typeof addProjectLanguage === 'function') {
            addProjectLanguage(language);
          }
          if (typeof updateCanvas === 'function') updateCanvas();
          if (typeof updateElementsList === 'function') updateElementsList();
          if (typeof saveState === 'function') await saveState();
          return { success: true, elementId, language };
        }
      },
      {
        name: 'get_screenshot_images',
        description: 'Get screenshot image data for copywriting. Returns data URLs (base64) for each screenshot in the specified language so the AI can analyze the app UI and generate headlines/subheadlines. Use this for magical titles generation.',
        inputSchema: {
          type: 'object',
          properties: {
            language: { type: 'string', description: "Language code to fetch images for, e.g. 'en'. Defaults to current project language." },
            maxImages: { type: 'integer', minimum: 1, maximum: 10, description: 'Maximum number of screenshots to return (default 10).' }
          },
          additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async ({ language, maxImages } = {}) => {
          const lang = language || state.currentLanguage || state.projectLanguages[0] || 'en';
          const limit = Math.min(maxImages || 10, state.screenshots.length);
          const results = [];
          for (let i = 0; i < limit; i++) {
            const s = state.screenshots[i];
            if (!s) continue;
            // Try requested language, fallback to any available
            let src = s.localizedImages?.[lang]?.src || null;
            if (!src) {
              for (const l of state.projectLanguages) {
                if (s.localizedImages?.[l]?.src) { src = s.localizedImages[l].src; break; }
              }
            }
            if (!src) src = s.image?.src || null;
            if (!src) continue;
            // Truncate if very large (limit ~500KB per image to avoid huge tool responses)
            // Data URLs for screenshots can be large; we return as-is but warn if too big
            const sizeKB = Math.round(src.length / 1024);
            results.push({
              index: i,
              name: s.name || `Screenshot ${i+1}`,
              language: lang,
              dataUrlPreview: src.substring(0, 100) + '...',
              dataUrlLength: src.length,
              sizeKB,
              // Return full data URL only if reasonably sized; agent can request single image if needed
              dataUrl: sizeKB < 800 ? src : null,
              truncated: sizeKB >= 800
            });
          }
          return {
            language: lang,
            count: results.length,
            totalScreenshots: state.screenshots.length,
            images: results,
            hint: results.some(r=>r.truncated) ? 'Some images truncated due to size. Call get_single_screenshot_image with screenshotIndex for full data.' : undefined
          };
        }
      },
      {
        name: 'get_single_screenshot_image',
        description: 'Get full image data URL for a single screenshot. Use when get_screenshot_images truncated an image or you need one screenshot at full resolution.',
        inputSchema: {
          type: 'object',
          properties: {
            screenshotIndex: { type: 'integer', minimum: 0, description: '0-based screenshot index' },
            language: { type: 'string', description: "Language code, e.g. 'en'. Defaults to current language." }
          },
          required: ['screenshotIndex'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async ({ screenshotIndex, language }) => {
          const s = state.screenshots[screenshotIndex];
          if (!s) throw new Error(`Screenshot index ${screenshotIndex} out of range`);
          const lang = language || state.currentLanguage || state.projectLanguages[0] || 'en';
          let src = s.localizedImages?.[lang]?.src || null;
          if (!src) {
            for (const l of state.projectLanguages) {
              if (s.localizedImages?.[l]?.src) { src = s.localizedImages[l].src; break; }
            }
          }
          if (!src) src = s.image?.src || null;
          if (!src) throw new Error(`No image found for screenshot ${screenshotIndex} in language ${lang}`);
          return {
            index: screenshotIndex,
            name: s.name || `Screenshot ${screenshotIndex+1}`,
            language: lang,
            dataUrl: src,
            sizeKB: Math.round(src.length/1024)
          };
        }
      },
      {
        name: 'generate_magical_titles',
        description: 'Generate marketing headlines and subheadlines for all screenshots. You are an expert App Store copywriter. After analyzing screenshot images via get_screenshot_images, call set_bulk_translations with your generated titles. This tool is a helper that validates and applies magical titles with App Store best practices (headline 2-4 words, subheadline 4-8 words, unique per screenshot, first headline is main value prop). Provide language and titles array.',
        inputSchema: {
          type: 'object',
          properties: {
            language: { type: 'string', description: "Language code to generate titles in, e.g. 'en', 'de'" },
            titles: {
              type: 'array',
              description: 'Array of titles, one per screenshot in order. Each entry has headline (2-4 words) and subheadline (4-8 words).',
              minItems: 1,
              items: {
                type: 'object',
                properties: {
                  headline: { type: 'string', description: 'Very short headline, 2-4 words, punchy, benefit-focused' },
                  subheadline: { type: 'string', description: 'Short subheadline, 4-8 words, expands on headline' }
                },
                required: ['headline', 'subheadline'],
                additionalProperties: false
              }
            }
          },
          required: ['language', 'titles'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async ({ language, titles }, { signal }) => {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          if (!isLanguageCodeValid(language)) throw new Error(`Invalid language code: ${language}`);
          if (!Array.isArray(titles) || titles.length === 0) throw new Error('titles must be non-empty array');
          if (titles.length !== state.screenshots.length) {
            throw new Error(`titles length ${titles.length} must match screenshots count ${state.screenshots.length}`);
          }
          if (!state.projectLanguages.includes(language) && typeof addProjectLanguage === 'function') {
            addProjectLanguage(language);
          }
          let applied = 0;
          for (let i = 0; i < titles.length; i++) {
            if (signal?.aborted) break;
            const entry = titles[i];
            const s = state.screenshots[i];
            if (!s) continue;
            const t = ensureScreenshotTextStructure(s);
            if (entry.headline) {
              if (entry.headline.length > 100) throw new Error(`Headline too long at index ${i} (max 100)`);
              t.headlines[language] = entry.headline;
              if (!t.headlineLanguages.includes(language)) t.headlineLanguages.push(language);
              t.headlineEnabled = true;
            }
            if (entry.subheadline) {
              if (entry.subheadline.length > 150) throw new Error(`Subheadline too long at index ${i} (max 150)`);
              t.subheadlines[language] = entry.subheadline;
              if (!t.subheadlineLanguages.includes(language)) t.subheadlineLanguages.push(language);
              if (entry.subheadline.trim()) t.subheadlineEnabled = true;
            }
            applied++;
          }
          if (typeof syncUIWithState === 'function') syncUIWithState();
          if (typeof updateCanvas === 'function') updateCanvas();
          if (typeof saveState === 'function') await saveState();
          return { success: true, language, applied, total: titles.length };
        }
      }
    ];
  }

  let alreadyRegistered = false;
  async function registerAll() {
    if (alreadyRegistered) return;
    if (typeof document === 'undefined') return;
    const modelContext = document.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== 'function') {
      // Not a WebMCP-capable browser — silent no-op (manual translation still works)
      return;
    }
    if (!hasRequiredGlobals()) {
      // App not yet initialized — retry shortly
      setTimeout(registerAll, 300);
      return;
    }
    alreadyRegistered = true;

    const defs = getToolsDefinitions();
    for (const def of defs) {
      try {
        await modelContext.registerTool({
          name: def.name,
          description: def.description,
          inputSchema: def.inputSchema,
          annotations: def.annotations,
          execute: def.execute
        });
      } catch (e) {
        // Duplicate registration (e.g. HMR) or invalid schema — warn but continue
        console.warn(`[WebMCP] registerTool failed for "${def.name}":`, e.message || e);
      }
    }
    console.info(`[WebMCP] Registered ${defs.length} translation tools`);
    // Expose for debugging / tests
    if (typeof window !== 'undefined') {
      window.__webmcpTools = defs.map(d => d.name);
    }
  }

  // Register as soon as possible, but after app.js has initialized state.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerAll);
  } else {
    // Slight delay to let app.js finish its init
    setTimeout(registerAll, 200);
  }

  // Also watch for late loads (e.g., if state is populated async from IndexedDB)
  let retries = 0;
  const retryInterval = setInterval(() => {
    if (hasRequiredGlobals() && document.modelContext) {
      clearInterval(retryInterval);
      registerAll();
    } else if (++retries > 20) {
      clearInterval(retryInterval);
    }
  }, 500);
})();
