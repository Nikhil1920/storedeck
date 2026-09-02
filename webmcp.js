// WebMCP Tools for AppScreen — Full autonomous workflow coverage (14 tools)
// Exposes project, screenshot, background, device, text, language, elements,
// popouts, output-size and export management to AI agents (ChatGPT, Claude, etc.)
// Spec: https://webmachinelearning.github.io/webmcp/
//
// Intended autonomous workflow:
//   1. Agent calls get_app_state to discover projects, screenshots, languages, output size.
//   2. Agent creates/selects a project (manage_project).
//   3. Agent uploads simulator screenshots (manage_screenshots action=upload, data URLs).
//   4. Agent views screenshots (get_images), writes headlines/subheadlines
//      (set_text_content) and styling (set_background / set_device /
//      set_text_style / set_output_size).
//   5. Agent asks the user for feedback, applies revisions with the same tools.
//   6. Agent exports full-resolution PNGs (export) and saves them to files for
//      upload to App Store Connect.
//
// Design note: tools are grouped by domain with an `action` parameter instead
// of one-tool-per-operation, to keep the total tool count (and therefore the
// agent's context usage) small. Per-action required fields are validated in
// execute() with explicit error messages.
//
// All tools are imperative, top-level, narrow, and reuse existing state helpers.
// No external LLM calls — the agent itself generates copy and writes via tools.

(function() {
  'use strict';

  // ---------------------------------------------------------------------------
  // Guards & shared helpers
  // ---------------------------------------------------------------------------

  function hasRequiredGlobals() {
    return typeof state !== 'undefined'
      && typeof languageNames !== 'undefined'
      && typeof languageFlags !== 'undefined';
  }

  function isLanguageCodeValid(code) {
    if (typeof code !== 'string' || !code) return false;
    if (typeof languageFlags !== 'undefined' && languageFlags[code]) return true;
    if (typeof languageNames !== 'undefined' && languageNames[code]) return true;
    return /^[a-z]{2}(-[a-z]{2})?$/i.test(code);
  }

  function isHexColor(s) {
    return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
  }

  function clampNum(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function abortError() {
    try {
      return new DOMException('Aborted', 'AbortError');
    } catch (e) {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      return err;
    }
  }

  function checkAborted(signal) {
    if (signal && signal.aborted) throw abortError();
  }

  function ensureScreenshotTextStructure(screenshot) {
    if (!screenshot.text) {
      if (typeof baseTextDefaults !== 'undefined') {
        screenshot.text = JSON.parse(JSON.stringify(baseTextDefaults));
      } else if (typeof normalizeTextSettings === 'function') {
        screenshot.text = normalizeTextSettings(null);
      } else {
        screenshot.text = { headlines: { en: '' }, subheadlines: { en: '' } };
      }
    }
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

  function resolveTargetIndex(screenshotIndex) {
    if (typeof screenshotIndex === 'number') {
      if (screenshotIndex < 0 || screenshotIndex >= state.screenshots.length) {
        throw new Error(`Invalid screenshotIndex ${screenshotIndex} (0-${state.screenshots.length - 1})`);
      }
      return screenshotIndex;
    }
    return state.selectedIndex;
  }

  // If the agent names a specific screenshot, focus it so the UI/canvas follows.
  // Returns the list of screenshot objects to mutate.
  function resolveTargets(screenshotIndex, applyToAll) {
    if (applyToAll) return state.screenshots;
    const idx = resolveTargetIndex(screenshotIndex);
    const s = state.screenshots[idx];
    if (!s) throw new Error(`No screenshot at index ${idx}`);
    if (typeof screenshotIndex === 'number' && screenshotIndex !== state.selectedIndex) {
      state.selectedIndex = screenshotIndex;
    }
    return [s];
  }

  function syncAll() {
    if (typeof syncUIWithState === 'function') syncUIWithState();
    if (typeof updateGradientStopsUI === 'function') {
      try { updateGradientStopsUI(); } catch (e) { /* non-critical */ }
    }
    if (typeof updateScreenshotList === 'function') {
      try { updateScreenshotList(); } catch (e) { /* non-critical */ }
    }
    if (typeof updateCanvas === 'function') updateCanvas();
  }

  async function persist() {
    if (typeof saveState === 'function') await saveState();
  }

  function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not decode image dataUrl (unsupported or corrupt image)'));
        img.src = dataUrl;
      } catch (e) {
        reject(e);
      }
    });
  }

  function validateImageDataUrl(dataUrl, filename) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      throw new Error(`"${filename || 'image'}" dataUrl must be a data:image/... URL (e.g. from canvas.toDataURL or a base64 PNG)`);
    }
    // ~18MB binary limit per image keeps IndexedDB + tool responses usable.
    if (dataUrl.length > 25000000) {
      throw new Error(`"${filename || 'image'}" image too large (${Math.round(dataUrl.length / 1024 / 1024)}MB URL, max ~18MB binary). Downscale before upload.`);
    }
  }

  function sanitizeBackground(bg) {
    if (!bg) return null;
    return {
      type: bg.type,
      gradient: bg.gradient ? { angle: bg.gradient.angle, stops: (bg.gradient.stops || []).map(s => ({ color: s.color, position: s.position })) } : null,
      solid: bg.solid,
      hasImage: !!bg.image,
      imageFit: bg.imageFit,
      imageBlur: bg.imageBlur,
      overlayColor: bg.overlayColor,
      overlayOpacity: bg.overlayOpacity,
      noise: !!bg.noise,
      noiseIntensity: bg.noiseIntensity
    };
  }

  function sanitizeElement(el) {
    const copy = { ...el };
    delete copy.image;
    copy.hasImage = !!(el.image || el.src);
    if (copy.src && copy.src.length > 200) copy.srcPreview = copy.src.substring(0, 100) + '...';
    return copy;
  }

  function sanitizeScreenshotSummary(s, i) {
    const text = s.text || {};
    const headlines = text.headlines || {};
    const subheadlines = text.subheadlines || {};
    return {
      index: i,
      name: s.name || `Screenshot ${i + 1}`,
      deviceType: s.deviceType || 'unknown',
      hasImage: !!(s.localizedImages && Object.values(s.localizedImages).some(l => l && l.src)) || !!(s.image && s.image.src),
      availableLanguages: s.localizedImages ? Object.keys(s.localizedImages) : [],
      isSelected: i === state.selectedIndex,
      headlines: { ...headlines },
      subheadlines: { ...subheadlines },
      missingLanguages: (state.projectLanguages || []).filter(lang => !headlines[lang]?.trim() && !subheadlines[lang]?.trim())
    };
  }

  function getDims() {
    if (typeof getCanvasDimensions === 'function') return getCanvasDimensions();
    if (state.outputDevice === 'custom') return { width: state.customWidth, height: state.customHeight };
    return (typeof deviceDimensions !== 'undefined' && deviceDimensions[state.outputDevice]) || { width: 1320, height: 2868 };
  }

  function listAvailableOutputSizes() {
    if (typeof deviceDimensions === 'undefined') return [];
    return Object.keys(deviceDimensions).map(id => ({
      id,
      width: deviceDimensions[id].width,
      height: deviceDimensions[id].height
    })).concat([{ id: 'custom', width: state.customWidth, height: state.customHeight }]);
  }

  function getLocalizedImageSrc(s, lang) {
    let src = (s.localizedImages && s.localizedImages[lang] && s.localizedImages[lang].src) || null;
    if (!src) {
      for (const l of state.projectLanguages) {
        if (s.localizedImages && s.localizedImages[l] && s.localizedImages[l].src) { src = s.localizedImages[l].src; break; }
      }
    }
    if (!src && s.image) src = s.image.src || null;
    return src;
  }

  // Render one screenshot offscreen at full export resolution and return dataUrl.
  // Temporarily switches selection/language, then restores everything.
  function renderExportDataUrl(index, lang) {
    const originalIndex = state.selectedIndex;
    const originalLang = state.currentLanguage;
    const originalTextLangs = state.screenshots.map(s => ({
      headline: s.text ? s.text.currentHeadlineLang : null,
      subheadline: s.text ? s.text.currentSubheadlineLang : null
    }));
    try {
      const targetLang = lang || state.currentLanguage;
      state.currentLanguage = targetLang;
      const target = state.screenshots[index];
      if (target && target.text) {
        target.text.currentHeadlineLang = targetLang;
        target.text.currentSubheadlineLang = targetLang;
      }
      state.selectedIndex = index;
      const dims = getDims();
      const off = document.createElement('canvas');
      off.width = dims.width;
      off.height = dims.height;
      const offCtx = off.getContext('2d');
      if (typeof renderScreenshotToCanvas !== 'function') {
        throw new Error('Export renderer not available (app still initializing)');
      }
      renderScreenshotToCanvas(index, off, offCtx, dims, 1);
      const dataUrl = off.toDataURL('image/png');
      return { dataUrl, width: dims.width, height: dims.height, language: targetLang };
    } finally {
      state.selectedIndex = originalIndex;
      state.currentLanguage = originalLang;
      state.screenshots.forEach((s, i) => {
        if (s.text && originalTextLangs[i]) {
          if (originalTextLangs[i].headline) s.text.currentHeadlineLang = originalTextLangs[i].headline;
          if (originalTextLangs[i].subheadline) s.text.currentSubheadlineLang = originalTextLangs[i].subheadline;
        }
      });
      if (typeof updateCanvas === 'function') updateCanvas();
    }
  }

  const POSITION_PRESETS = {
    'centered': { scale: 70, x: 50, y: 50, rotation: 0, perspective: 0 },
    'bleed-bottom': { scale: 85, x: 50, y: 120, rotation: 0, perspective: 0 },
    'bleed-top': { scale: 85, x: 50, y: -20, rotation: 0, perspective: 0 },
    'float-center': { scale: 60, x: 50, y: 50, rotation: 0, perspective: 0 },
    'tilt-left': { scale: 65, x: 50, y: 60, rotation: -8, perspective: 0 },
    'tilt-right': { scale: 65, x: 50, y: 60, rotation: 8, perspective: 0 },
    'perspective': { scale: 65, x: 50, y: 50, rotation: 0, perspective: 15 },
    'float-bottom': { scale: 55, x: 50, y: 70, rotation: 0, perspective: 0 }
  };

  function applyDeviceFields(ss, fields) {
    if (fields.scale !== undefined) ss.scale = clampNum(fields.scale, 30, 100);
    if (fields.x !== undefined) ss.x = clampNum(fields.x, -80, 180);
    if (fields.y !== undefined) ss.y = clampNum(fields.y, -80, 180);
    if (fields.rotation !== undefined) ss.rotation = clampNum(fields.rotation, -45, 45);
    if (fields.perspective !== undefined) ss.perspective = clampNum(fields.perspective, 0, 50);
    if (fields.cornerRadius !== undefined) ss.cornerRadius = clampNum(fields.cornerRadius, 0, 100);
    if (fields.use3D !== undefined) ss.use3D = !!fields.use3D;
    if (fields.device3D !== undefined) {
      if (!['iphone', 'samsung'].includes(fields.device3D)) throw new Error(`Invalid device3D "${fields.device3D}" (expected "iphone" or "samsung")`);
      ss.device3D = fields.device3D;
    }
    if (fields.frameColor !== undefined) ss.frameColor = fields.frameColor;
    if (fields.rotation3D !== undefined) {
      ss.rotation3D = ss.rotation3D || { x: 0, y: 0, z: 0 };
      for (const axis of ['x', 'y', 'z']) {
        if (fields.rotation3D[axis] !== undefined) ss.rotation3D[axis] = clampNum(fields.rotation3D[axis], -45, 45);
      }
    }
    if (fields.shadow !== undefined) {
      ss.shadow = ss.shadow || {};
      const sh = fields.shadow;
      if (sh.enabled !== undefined) ss.shadow.enabled = !!sh.enabled;
      if (sh.color !== undefined) { if (!isHexColor(sh.color)) throw new Error(`Invalid shadow.color "${sh.color}" (expected #rrggbb)`); ss.shadow.color = sh.color; }
      if (sh.blur !== undefined) ss.shadow.blur = clampNum(sh.blur, 0, 100);
      if (sh.opacity !== undefined) ss.shadow.opacity = clampNum(sh.opacity, 0, 100);
      if (sh.x !== undefined) ss.shadow.x = clampNum(sh.x, -50, 50);
      if (sh.y !== undefined) ss.shadow.y = clampNum(sh.y, -50, 100);
    }
    if (fields.frame !== undefined) {
      ss.frame = ss.frame || {};
      const fr = fields.frame;
      if (fr.enabled !== undefined) ss.frame.enabled = !!fr.enabled;
      if (fr.color !== undefined) { if (!isHexColor(fr.color)) throw new Error(`Invalid frame.color "${fr.color}" (expected #rrggbb)`); ss.frame.color = fr.color; }
      if (fr.width !== undefined) ss.frame.width = clampNum(fr.width, 1, 50);
      if (fr.opacity !== undefined) ss.frame.opacity = clampNum(fr.opacity, 0, 100);
    }
  }

  function applyTextStyleFields(text, fields, langForLayout) {
    const directKeys = ['headlineEnabled', 'headlineFont', 'headlineWeight', 'headlineColor',
      'headlineItalic', 'headlineUnderline', 'headlineStrikethrough',
      'subheadlineEnabled', 'subheadlineFont', 'subheadlineWeight', 'subheadlineColor',
      'subheadlineOpacity', 'subheadlineItalic', 'subheadlineUnderline', 'subheadlineStrikethrough',
      'perLanguageLayout'];
    for (const k of directKeys) {
      if (fields[k] !== undefined) text[k] = fields[k];
    }
    if (fields.headlineColor !== undefined && !isHexColor(fields.headlineColor)) throw new Error(`Invalid headlineColor "${fields.headlineColor}"`);
    if (fields.subheadlineColor !== undefined && !isHexColor(fields.subheadlineColor)) throw new Error(`Invalid subheadlineColor "${fields.subheadlineColor}"`);
    // Layout fields respect perLanguageLayout, mirroring setTextLanguageValue.
    const layoutKeys = ['headlineSize', 'subheadlineSize', 'position', 'offsetY', 'lineHeight'];
    const hasLayout = layoutKeys.some(k => fields[k] !== undefined);
    if (hasLayout) {
      if (fields.position !== undefined && !['top', 'bottom'].includes(fields.position)) {
        throw new Error(`Invalid position "${fields.position}" (expected "top" or "bottom")`);
      }
      if (!text.perLanguageLayout) {
        if (fields.headlineSize !== undefined) text.headlineSize = fields.headlineSize;
        if (fields.subheadlineSize !== undefined) text.subheadlineSize = fields.subheadlineSize;
        if (fields.position !== undefined) text.position = fields.position;
        if (fields.offsetY !== undefined) text.offsetY = fields.offsetY;
        if (fields.lineHeight !== undefined) text.lineHeight = fields.lineHeight;
      } else {
        const targetLang = langForLayout || text.currentLayoutLang || text.currentHeadlineLang || 'en';
        if (!text.languageSettings) text.languageSettings = {};
        if (!text.languageSettings[targetLang]) {
          text.languageSettings[targetLang] = { headlineSize: 100, subheadlineSize: 50, position: 'top', offsetY: 12, lineHeight: 110 };
        }
        const ls = text.languageSettings[targetLang];
        if (fields.headlineSize !== undefined) ls.headlineSize = fields.headlineSize;
        if (fields.subheadlineSize !== undefined) ls.subheadlineSize = fields.subheadlineSize;
        if (fields.position !== undefined) ls.position = fields.position;
        if (fields.offsetY !== undefined) ls.offsetY = fields.offsetY;
        if (fields.lineHeight !== undefined) ls.lineHeight = fields.lineHeight;
        text.currentLayoutLang = targetLang;
      }
    }
  }

  function findElementTarget(elementId, screenshotIndex) {
    if (typeof screenshotIndex === 'number') {
      const s = state.screenshots[screenshotIndex];
      if (!s) throw new Error(`Invalid screenshotIndex ${screenshotIndex}`);
      const el = (s.elements || []).find(e => e.id === elementId);
      if (!el) throw new Error(`Element ${elementId} not found on screenshot ${screenshotIndex}`);
      return { screenshot: s, index: screenshotIndex, element: el };
    }
    for (let i = 0; i < state.screenshots.length; i++) {
      const el = (state.screenshots[i].elements || []).find(e => e.id === elementId);
      if (el) return { screenshot: state.screenshots[i], index: i, element: el };
    }
    throw new Error(`Element ${elementId} not found in any screenshot`);
  }

  function findPopoutTarget(popoutId, screenshotIndex) {
    if (typeof screenshotIndex === 'number') {
      const s = state.screenshots[screenshotIndex];
      if (!s) throw new Error(`Invalid screenshotIndex ${screenshotIndex}`);
      const p = (s.popouts || []).find(x => x.id === popoutId);
      if (!p) throw new Error(`Popout ${popoutId} not found on screenshot ${screenshotIndex}`);
      return { screenshot: s, index: screenshotIndex, popout: p };
    }
    for (let i = 0; i < state.screenshots.length; i++) {
      const p = (state.screenshots[i].popouts || []).find(x => x.id === popoutId);
      if (p) return { screenshot: state.screenshots[i], index: i, popout: p };
    }
    throw new Error(`Popout ${popoutId} not found in any screenshot`);
  }

  function requireOwnedProjects() {
    if (typeof projects === 'undefined' || !Array.isArray(projects)) {
      throw new Error('Project list not available (app still initializing)');
    }
  }

  // ---------------------------------------------------------------------------
  // Tool definitions (14 tools)
  // ---------------------------------------------------------------------------

  function getToolsDefinitions() {
    return [
      {
        name: 'get_app_state',
        description: 'START HERE. Read the full current state: project info, all projects, output size and available sizes, every screenshot summary with headlines/subheadlines, and the selected screenshot\'s complete background, device, text, elements and popouts settings. Image bytes are NOT included (use get_images for vision). Call this first and after major changes to verify.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async () => {
          const dims = getDims();
          const current = state.screenshots[state.selectedIndex] || null;
          let currentDetails = null;
          if (current) {
            const text = ensureScreenshotTextStructure(current);
            currentDetails = {
              index: state.selectedIndex,
              name: current.name,
              deviceType: current.deviceType,
              availableLanguages: current.localizedImages ? Object.keys(current.localizedImages) : [],
              background: sanitizeBackground(current.background),
              device: current.screenshot ? JSON.parse(JSON.stringify(current.screenshot)) : null,
              text: JSON.parse(JSON.stringify(text)),
              elements: (current.elements || []).map(sanitizeElement),
              popouts: current.popouts ? JSON.parse(JSON.stringify(current.popouts)) : []
            };
          }
          let projectName = 'Current Project';
          let projectsList = [];
          try {
            if (typeof projects !== 'undefined' && Array.isArray(projects)) {
              projectsList = projects.map(p => ({
                id: p.id,
                name: p.name,
                screenshotCount: p.screenshotCount,
                isCurrent: (typeof currentProjectId !== 'undefined') ? p.id === currentProjectId : undefined
              }));
              const cur = projects.find(p => typeof currentProjectId !== 'undefined' && p.id === currentProjectId);
              if (cur) projectName = cur.name;
            }
          } catch (e) { /* non-critical */ }
          return {
            app: 'appscreen',
            project: {
              name: projectName,
              screenshotCount: state.screenshots.length,
              selectedIndex: state.selectedIndex,
              currentLanguage: state.currentLanguage,
              projectLanguages: [...state.projectLanguages],
              languageNames: { ...languageNames },
              languageFlags: { ...languageFlags },
              outputDevice: state.outputDevice,
              outputWidth: dims.width,
              outputHeight: dims.height,
              availableOutputSizes: listAvailableOutputSizes()
            },
            projects: projectsList,
            screenshots: state.screenshots.map((s, i) => sanitizeScreenshotSummary(s, i)),
            current: currentDetails,
            hint: state.screenshots.length === 0
              ? 'No screenshots yet. Upload simulator screenshots with manage_screenshots action=upload first.'
              : 'Use set_text_content for copy, set_background/set_device/set_text_style for design, export for output.'
          };
        }
      },
      {
        name: 'manage_project',
        description: 'Manage projects. Actions: create (needs name — new empty project, switches to it), switch (needs projectId from get_app_state projects — saves current first), rename (needs name — renames the open project).',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['create', 'switch', 'rename'] },
            name: { type: 'string', description: 'Project name for create/rename (1-100 chars)' },
            projectId: { type: 'string', description: 'Project id for switch' }
          },
          required: ['action'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async ({ action, name, projectId }, { signal }) => {
          checkAborted(signal);
          if (action === 'create') {
            if (!name) throw new Error('action "create" requires name');
            if (typeof createProject !== 'function') throw new Error('createProject not available');
            await createProject(name);
            return { success: true, action, id: (typeof currentProjectId !== 'undefined') ? currentProjectId : null, name };
          }
          if (action === 'switch') {
            if (!projectId) throw new Error('action "switch" requires projectId');
            if (typeof switchProject !== 'function') throw new Error('switchProject not available');
            await switchProject(projectId);
            return { success: true, action, projectId, screenshotCount: state.screenshots.length };
          }
          if (action === 'rename') {
            if (!name) throw new Error('action "rename" requires name');
            if (typeof renameProject !== 'function') throw new Error('renameProject not available');
            renameProject(name);
            await persist();
            return { success: true, action, name };
          }
          throw new Error(`Unknown action "${action}"`);
        }
      },
      {
        name: 'manage_screenshots',
        description: 'Manage screenshots. Actions: upload (needs screenshots [{filename, dataUrl, language?}] — simulator PNGs as data:image/... URLs, max 10 per call; language suffixes like _de/-fr in filenames are auto-detected; files matching an existing screenshot become its localized variants, otherwise new screenshots are created), select (needs screenshotIndex — focus it on canvas), delete (needs screenshotIndex — cannot undo), duplicate (needs screenshotIndex — copies design, text and images), move (needs fromIndex+toIndex — reorders for App Store order).',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['upload', 'select', 'delete', 'duplicate', 'move'] },
            screenshotIndex: { type: 'integer', minimum: 0, description: 'For select/delete/duplicate' },
            fromIndex: { type: 'integer', minimum: 0, description: 'For move' },
            toIndex: { type: 'integer', minimum: 0, description: 'For move' },
            screenshots: {
              type: 'array', minItems: 1, maxItems: 10, description: 'For upload',
              items: {
                type: 'object',
                properties: {
                  filename: { type: 'string', description: 'Original filename, e.g. "home_en.png"' },
                  dataUrl: { type: 'string', description: 'Full data URL: data:image/png;base64,...' },
                  language: { type: 'string', description: 'Optional explicit BCP-47 code, overrides filename detection' }
                },
                required: ['filename', 'dataUrl'],
                additionalProperties: false
              }
            }
          },
          required: ['action'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async ({ action, screenshotIndex, fromIndex, toIndex, screenshots }, { signal }) => {
          checkAborted(signal);
          if (action === 'upload') {
            if (!Array.isArray(screenshots) || screenshots.length === 0) throw new Error('action "upload" requires screenshots array');
            if (screenshots.length > 10) throw new Error('Max 10 screenshots per call');
            if (typeof createNewScreenshot !== 'function') throw new Error('Screenshot creation not available');
            let added = 0;
            let localized = 0;
            const details = [];
            for (const item of screenshots) {
              checkAborted(signal);
              validateImageDataUrl(item.dataUrl, item.filename);
              const lang = item.language
                || (typeof detectLanguageFromFilename === 'function' ? detectLanguageFromFilename(item.filename) : null)
                || state.currentLanguage || 'en';
              if (!isLanguageCodeValid(lang)) throw new Error(`Invalid language "${lang}" for file "${item.filename}"`);
              const img = await loadImageFromDataUrl(item.dataUrl);
              checkAborted(signal);
              const ratio = img.width / img.height;
              const deviceType = ratio > 0.6 ? 'iPad' : 'iPhone';
              const existingIndex = (typeof findScreenshotByBaseFilename === 'function')
                ? findScreenshotByBaseFilename(item.filename)
                : -1;
              if (existingIndex !== -1 && state.screenshots[existingIndex]) {
                const existed = !!(state.screenshots[existingIndex].localizedImages && state.screenshots[existingIndex].localizedImages[lang]);
                if (typeof addLocalizedImage === 'function') {
                  addLocalizedImage(existingIndex, lang, img, item.dataUrl, item.filename);
                } else {
                  state.screenshots[existingIndex].localizedImages = state.screenshots[existingIndex].localizedImages || {};
                  state.screenshots[existingIndex].localizedImages[lang] = { image: img, src: item.dataUrl, name: item.filename };
                }
                localized++;
                details.push({ filename: item.filename, action: existed ? 'replaced-localized-image' : 'added-localized-image', screenshotIndex: existingIndex, language: lang, width: img.width, height: img.height });
              } else {
                createNewScreenshot(img, item.dataUrl, item.filename, lang, deviceType);
                added++;
                details.push({ filename: item.filename, action: 'created-screenshot', screenshotIndex: state.screenshots.length - 1, language: lang, width: img.width, height: img.height });
              }
            }
            if (typeof updateScreenTexture === 'function') {
              try {
                const ss = (state.screenshots[state.selectedIndex] || {}).screenshot;
                if (ss && ss.use3D) updateScreenTexture();
              } catch (e) { /* non-critical */ }
            }
            syncAll();
            await persist();
            return { success: true, action, added, localized, total: state.screenshots.length, details };
          }
          if (action === 'select') {
            if (typeof screenshotIndex !== 'number') throw new Error('action "select" requires screenshotIndex');
            if (screenshotIndex < 0 || screenshotIndex >= state.screenshots.length) throw new Error(`Invalid screenshotIndex ${screenshotIndex}`);
            state.selectedIndex = screenshotIndex;
            syncAll();
            await persist();
            return { success: true, action, selectedIndex: screenshotIndex, name: state.screenshots[screenshotIndex].name };
          }
          if (action === 'delete') {
            if (typeof screenshotIndex !== 'number') throw new Error('action "delete" requires screenshotIndex');
            if (screenshotIndex < 0 || screenshotIndex >= state.screenshots.length) throw new Error(`Invalid screenshotIndex ${screenshotIndex}`);
            const removed = state.screenshots.splice(screenshotIndex, 1)[0];
            if (state.selectedIndex >= state.screenshots.length) {
              state.selectedIndex = Math.max(0, state.screenshots.length - 1);
            }
            syncAll();
            await persist();
            return { success: true, action, removed: removed ? removed.name : null, remaining: state.screenshots.length, selectedIndex: state.selectedIndex };
          }
          if (action === 'duplicate') {
            if (typeof screenshotIndex !== 'number') throw new Error('action "duplicate" requires screenshotIndex');
            if (typeof duplicateScreenshot !== 'function') throw new Error('duplicateScreenshot not available');
            if (screenshotIndex < 0 || screenshotIndex >= state.screenshots.length) throw new Error(`Invalid screenshotIndex ${screenshotIndex}`);
            duplicateScreenshot(screenshotIndex);
            await persist();
            return { success: true, action, newIndex: state.selectedIndex, total: state.screenshots.length };
          }
          if (action === 'move') {
            if (typeof fromIndex !== 'number' || typeof toIndex !== 'number') throw new Error('action "move" requires fromIndex and toIndex');
            const n = state.screenshots.length;
            if (fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n) {
              throw new Error(`Invalid move ${fromIndex} -> ${toIndex} (0-${n - 1})`);
            }
            const [moved] = state.screenshots.splice(fromIndex, 1);
            state.screenshots.splice(toIndex, 0, moved);
            if (state.selectedIndex === fromIndex) state.selectedIndex = toIndex;
            else if (fromIndex < state.selectedIndex && toIndex >= state.selectedIndex) state.selectedIndex--;
            else if (fromIndex > state.selectedIndex && toIndex <= state.selectedIndex) state.selectedIndex++;
            syncAll();
            await persist();
            return { success: true, action, order: state.screenshots.map(s => s.name), selectedIndex: state.selectedIndex };
          }
          throw new Error(`Unknown action "${action}"`);
        }
      },
      {
        name: 'set_background',
        description: 'Set the background of one screenshot (default: selected) or all with applyToAll: gradient (gradientAngle + gradientStops [{color #rrggbb, position 0-100}]), solid color (solid #rrggbb), uploaded image (backgroundImageDataUrl sets type to image unless type is given), imageFit/cover-contain-stretch, imageBlur, overlayColor/overlayOpacity, noise/noiseIntensity.',
        inputSchema: {
          type: 'object',
          properties: {
            screenshotIndex: { type: 'integer', minimum: 0, description: 'Optional; defaults to selected' },
            applyToAll: { type: 'boolean', description: 'Apply to every screenshot (keeps current selection)' },
            type: { type: 'string', enum: ['gradient', 'solid', 'image'] },
            solid: { type: 'string', description: 'Hex color #rrggbb' },
            gradientAngle: { type: 'integer', minimum: 0, maximum: 360 },
            gradientStops: {
              type: 'array', minItems: 2, maxItems: 8,
              items: {
                type: 'object',
                properties: {
                  color: { type: 'string' },
                  position: { type: 'number', minimum: 0, maximum: 100 }
                },
                required: ['color', 'position'],
                additionalProperties: false
              }
            },
            backgroundImageDataUrl: { type: 'string', description: 'data:image/... URL' },
            imageFit: { type: 'string', enum: ['cover', 'contain', 'stretch'] },
            imageBlur: { type: 'integer', minimum: 0, maximum: 50 },
            overlayColor: { type: 'string', description: 'Hex #rrggbb' },
            overlayOpacity: { type: 'integer', minimum: 0, maximum: 100 },
            noise: { type: 'boolean' },
            noiseIntensity: { type: 'integer', minimum: 0, maximum: 100 }
          },
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async (args, { signal }) => {
          checkAborted(signal);
          if (state.screenshots.length === 0) throw new Error('No screenshots yet — upload with manage_screenshots action=upload first');
          const targets = resolveTargets(args.screenshotIndex, args.applyToAll);

          let bgImage = null;
          let bgImageSrc = null;
          if (args.backgroundImageDataUrl !== undefined) {
            validateImageDataUrl(args.backgroundImageDataUrl, 'background');
            bgImage = await loadImageFromDataUrl(args.backgroundImageDataUrl);
            bgImageSrc = args.backgroundImageDataUrl;
            checkAborted(signal);
          }
          if (args.gradientStops !== undefined) {
            for (const stop of args.gradientStops) {
              if (!isHexColor(stop.color)) throw new Error(`Invalid gradient stop color "${stop.color}" (expected #rrggbb)`);
            }
          }
          if (args.solid !== undefined && !isHexColor(args.solid)) throw new Error(`Invalid solid "${args.solid}" (expected #rrggbb)`);
          if (args.overlayColor !== undefined && !isHexColor(args.overlayColor)) throw new Error(`Invalid overlayColor "${args.overlayColor}"`);

          for (const s of targets) {
            const bg = s.background;
            if (args.type !== undefined) bg.type = args.type;
            else if (bgImage) bg.type = 'image';
            if (args.solid !== undefined) bg.solid = args.solid;
            if (args.gradientAngle !== undefined) { bg.gradient = bg.gradient || {}; bg.gradient.angle = args.gradientAngle; }
            if (args.gradientStops !== undefined) {
              bg.gradient = bg.gradient || {};
              bg.gradient.stops = [...args.gradientStops].sort((a, b) => a.position - b.position).map(x => ({ color: x.color, position: x.position }));
            }
            if (bgImage) { bg.image = bgImage; bg.imageSrc = bgImageSrc; }
            if (args.imageFit !== undefined) bg.imageFit = args.imageFit;
            if (args.imageBlur !== undefined) bg.imageBlur = args.imageBlur;
            if (args.overlayColor !== undefined) bg.overlayColor = args.overlayColor;
            if (args.overlayOpacity !== undefined) bg.overlayOpacity = args.overlayOpacity;
            if (args.noise !== undefined) bg.noise = !!args.noise;
            if (args.noiseIntensity !== undefined) bg.noiseIntensity = args.noiseIntensity;
          }

          syncAll();
          await persist();
          const focusIdx = args.applyToAll ? state.selectedIndex : resolveTargetIndex(args.screenshotIndex);
          return { success: true, updated: targets.length, background: sanitizeBackground(state.screenshots[focusIdx].background) };
        }
      },
      {
        name: 'set_device',
        description: 'Set the device-frame layout of one screenshot (default: selected) or all with applyToAll: position preset (centered, bleed-bottom, bleed-top, float-center, tilt-left, tilt-right, perspective, float-bottom — explicit fields override the preset), scale/x/y/rotation/perspective/cornerRadius, 3D mode (use3D, device3D iphone|samsung, frameColor, rotation3D {x,y,z}), 2D shadow {enabled,color,blur,opacity,x,y} and border frame {enabled,color,width,opacity}.',
        inputSchema: {
          type: 'object',
          properties: {
            screenshotIndex: { type: 'integer', minimum: 0 },
            applyToAll: { type: 'boolean' },
            preset: { type: 'string', enum: ['centered', 'bleed-bottom', 'bleed-top', 'float-center', 'tilt-left', 'tilt-right', 'perspective', 'float-bottom'] },
            scale: { type: 'number', minimum: 30, maximum: 100 },
            x: { type: 'number', minimum: -80, maximum: 180 },
            y: { type: 'number', minimum: -80, maximum: 180 },
            rotation: { type: 'number', minimum: -45, maximum: 45 },
            perspective: { type: 'number', minimum: 0, maximum: 50 },
            cornerRadius: { type: 'number', minimum: 0, maximum: 100 },
            use3D: { type: 'boolean' },
            device3D: { type: 'string', enum: ['iphone', 'samsung'] },
            frameColor: { type: 'string', description: '3D frame color preset id' },
            rotation3D: {
              type: 'object',
              properties: {
                x: { type: 'number', minimum: -45, maximum: 45 },
                y: { type: 'number', minimum: -45, maximum: 45 },
                z: { type: 'number', minimum: -45, maximum: 45 }
              },
              additionalProperties: false
            },
            shadow: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                color: { type: 'string' },
                blur: { type: 'number', minimum: 0, maximum: 100 },
                opacity: { type: 'number', minimum: 0, maximum: 100 },
                x: { type: 'number', minimum: -50, maximum: 50 },
                y: { type: 'number', minimum: -50, maximum: 100 }
              },
              additionalProperties: false
            },
            frame: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                color: { type: 'string' },
                width: { type: 'number', minimum: 1, maximum: 50 },
                opacity: { type: 'number', minimum: 0, maximum: 100 }
              },
              additionalProperties: false
            }
          },
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async (args, { signal }) => {
          checkAborted(signal);
          if (state.screenshots.length === 0) throw new Error('No screenshots yet — upload with manage_screenshots action=upload first');
          const targets = resolveTargets(args.screenshotIndex, args.applyToAll);
          const fields = { ...args };
          delete fields.screenshotIndex;
          delete fields.applyToAll;
          delete fields.preset;
          if (args.preset !== undefined && !POSITION_PRESETS[args.preset]) {
            throw new Error(`Unknown preset "${args.preset}"`);
          }
          for (const s of targets) {
            if (args.preset) Object.assign(s.screenshot, { ...POSITION_PRESETS[args.preset] });
            applyDeviceFields(s.screenshot, fields);
          }
          if (typeof updateScreenTexture === 'function') {
            try {
              if (targets.some(s => s.screenshot && s.screenshot.use3D)) updateScreenTexture();
            } catch (e) { /* non-critical */ }
          }
          syncAll();
          await persist();
          const focusIdx = args.applyToAll ? state.selectedIndex : resolveTargetIndex(args.screenshotIndex);
          return { success: true, updated: targets.length, device: JSON.parse(JSON.stringify(state.screenshots[focusIdx].screenshot)) };
        }
      },
      {
        name: 'set_text_content',
        description: 'Set headline/subheadline TEXT (content, not styling — use set_text_style for fonts/sizes/colors). You are an expert App Store copywriter: after viewing screenshots via get_images, write one headline (2-4 words, punchy, benefit-focused) + subheadline (4-8 words, expands the headline) per screenshot, unique per screenshot with the first as the main value prop, then apply them all in ONE call with translations [{screenshotIndex, kind: headline|subheadline, language, text}]. Prefer a single call over many. Creates language entries as needed (max 500 chars each, 200 entries per call).',
        inputSchema: {
          type: 'object',
          properties: {
            translations: {
              type: 'array',
              description: 'Translation entries to apply',
              minItems: 1,
              maxItems: 200,
              items: {
                type: 'object',
                properties: {
                  screenshotIndex: { type: 'integer', minimum: 0 },
                  kind: { type: 'string', enum: ['headline', 'subheadline'] },
                  language: { type: 'string', description: "BCP-47 code e.g. 'de', 'pt-br'" },
                  text: { type: 'string', description: 'Text content, max 500 chars' }
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
          checkAborted(signal);
          if (!Array.isArray(translations) || translations.length === 0) {
            throw new Error('translations must be a non-empty array');
          }
          if (translations.length > 200) throw new Error('Too many translations at once (max 200)');

          let applied = 0;
          const errors = [];
          const touchedLanguages = new Set();

          for (let i = 0; i < translations.length; i++) {
            if (signal && signal.aborted) break;
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
              errors.push(`invalid text at position ${i} (must be a string, max 500 chars)`);
              continue;
            }

            const t = ensureScreenshotTextStructure(s);
            if (entry.kind === 'headline') {
              t.headlines[entry.language] = entry.text;
              if (!t.headlineLanguages.includes(entry.language)) t.headlineLanguages.push(entry.language);
              t.headlineEnabled = true;
            } else if (entry.kind === 'subheadline') {
              t.subheadlines[entry.language] = entry.text;
              if (!t.subheadlineLanguages.includes(entry.language)) t.subheadlineLanguages.push(entry.language);
              if (entry.text.trim()) t.subheadlineEnabled = true;
            } else {
              errors.push(`invalid kind ${entry.kind} at position ${i}`);
              continue;
            }
            touchedLanguages.add(entry.language);
            applied++;
          }

          for (const lang of touchedLanguages) {
            if (!state.projectLanguages.includes(lang) && typeof addProjectLanguage === 'function') {
              addProjectLanguage(lang);
            }
          }

          syncAll();
          await persist();

          const result = { applied, total: translations.length };
          if (errors.length) result.errors = errors;
          if (signal && signal.aborted) result.aborted = true;
          return result;
        }
      },
      {
        name: 'set_text_style',
        description: 'Set headline/subheadline STYLING (presentation, not content — use set_text_content for the actual words) of one screenshot (default: selected) or all with applyToAll: fonts, sizes, weights, colors (#rrggbb), italic/underline/strikethrough, subheadlineOpacity, position (top|bottom), offsetY, lineHeight, perLanguageLayout (when on, pass language to style one language layout).',
        inputSchema: {
          type: 'object',
          properties: {
            screenshotIndex: { type: 'integer', minimum: 0 },
            applyToAll: { type: 'boolean' },
            language: { type: 'string', description: 'Layout language when perLanguageLayout is on' },
            headlineEnabled: { type: 'boolean' },
            headlineFont: { type: 'string' },
            headlineSize: { type: 'number', minimum: 10, maximum: 300 },
            headlineWeight: { type: 'string' },
            headlineColor: { type: 'string' },
            headlineItalic: { type: 'boolean' },
            headlineUnderline: { type: 'boolean' },
            headlineStrikethrough: { type: 'boolean' },
            subheadlineEnabled: { type: 'boolean' },
            subheadlineFont: { type: 'string' },
            subheadlineSize: { type: 'number', minimum: 10, maximum: 200 },
            subheadlineWeight: { type: 'string' },
            subheadlineColor: { type: 'string' },
            subheadlineOpacity: { type: 'number', minimum: 0, maximum: 100 },
            subheadlineItalic: { type: 'boolean' },
            subheadlineUnderline: { type: 'boolean' },
            subheadlineStrikethrough: { type: 'boolean' },
            position: { type: 'string', enum: ['top', 'bottom'] },
            offsetY: { type: 'number', minimum: -50, maximum: 100 },
            lineHeight: { type: 'number', minimum: 50, maximum: 300 },
            perLanguageLayout: { type: 'boolean' }
          },
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async (args, { signal }) => {
          checkAborted(signal);
          if (state.screenshots.length === 0) throw new Error('No screenshots yet — upload with manage_screenshots action=upload first');
          const targets = resolveTargets(args.screenshotIndex, args.applyToAll);
          if (args.language !== undefined && !isLanguageCodeValid(args.language)) {
            throw new Error(`Invalid language "${args.language}"`);
          }
          const fields = { ...args };
          delete fields.screenshotIndex;
          delete fields.applyToAll;
          delete fields.language;
          for (const s of targets) {
            const t = ensureScreenshotTextStructure(s);
            for (const fontKey of ['headlineFont', 'subheadlineFont']) {
              if (fields[fontKey] && typeof loadGoogleFont === 'function') {
                try { await loadGoogleFont(fields[fontKey]); } catch (e) { /* keep going with fallback */ }
              }
              if (signal && signal.aborted) break;
            }
            applyTextStyleFields(t, fields, args.language);
          }
          checkAborted(signal);
          syncAll();
          await persist();
          return { success: true, updated: targets.length };
        }
      },
      {
        name: 'manage_languages',
        description: 'Manage project languages. Actions: add (needs language — new language for future texts/images), remove (needs language — keeps existing texts, drops it from the active list; cannot remove the last one), switch (needs language — switches preview/edit language for the whole project, i.e. which localized image and headline/subheadline is shown on canvas). Language codes are BCP-47 like de, fr, pt-br.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['add', 'remove', 'switch'] },
            language: { type: 'string' }
          },
          required: ['action', 'language'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async ({ action, language }, { signal }) => {
          checkAborted(signal);
          if (!isLanguageCodeValid(language)) throw new Error(`Invalid language code: ${language}`);
          if (action === 'add') {
            if (state.projectLanguages.includes(language)) {
              return { success: true, action, alreadyExisted: true, language, projectLanguages: [...state.projectLanguages] };
            }
            if (typeof addProjectLanguage !== 'function') throw new Error('addProjectLanguage not available');
            addProjectLanguage(language);
            await persist();
            return { success: true, action, language, projectLanguages: [...state.projectLanguages] };
          }
          if (action === 'remove') {
            if (!state.projectLanguages.includes(language)) {
              return { success: true, action, alreadyMissing: true, language };
            }
            if (state.projectLanguages.length <= 1) throw new Error('Cannot remove the last language');
            if (typeof removeProjectLanguage === 'function') {
              removeProjectLanguage(language);
            } else {
              state.projectLanguages = state.projectLanguages.filter(l => l !== language);
              if (state.currentLanguage === language) state.currentLanguage = state.projectLanguages[0];
              syncAll();
            }
            await persist();
            return { success: true, action, language, projectLanguages: [...state.projectLanguages] };
          }
          if (action === 'switch') {
            if (!state.projectLanguages.includes(language)) {
              throw new Error(`Language "${language}" is not in this project (${state.projectLanguages.join(', ')}). Add it first with action=add.`);
            }
            if (typeof switchGlobalLanguage === 'function') {
              switchGlobalLanguage(language);
            } else {
              state.currentLanguage = language;
              syncAll();
            }
            await persist();
            return { success: true, action, currentLanguage: state.currentLanguage };
          }
          throw new Error(`Unknown action "${action}"`);
        }
      },
      {
        name: 'get_images',
        description: 'Get screenshot IMAGE data for vision (copywriting, design review). Without screenshotIndex returns up to maxImages screenshots in the given language as data URLs (large images are truncated — then request them individually); with screenshotIndex returns that one screenshot at full resolution. Defaults to the current project language.',
        inputSchema: {
          type: 'object',
          properties: {
            screenshotIndex: { type: 'integer', minimum: 0, description: 'Optional; when given, returns this one screenshot full-res' },
            language: { type: 'string', description: "Language code, e.g. 'en'. Defaults to current." },
            maxImages: { type: 'integer', minimum: 1, maximum: 10, description: 'Batch mode only (default 10).' }
          },
          additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async ({ screenshotIndex, language, maxImages } = {}) => {
          const lang = language || state.currentLanguage || state.projectLanguages[0] || 'en';
          if (typeof screenshotIndex === 'number') {
            const s = state.screenshots[screenshotIndex];
            if (!s) throw new Error(`Screenshot index ${screenshotIndex} out of range`);
            const src = getLocalizedImageSrc(s, lang);
            if (!src) throw new Error(`No image found for screenshot ${screenshotIndex} in language ${lang}`);
            return { index: screenshotIndex, name: s.name || `Screenshot ${screenshotIndex + 1}`, language: lang, dataUrl: src, sizeKB: Math.round(src.length / 1024) };
          }
          const limit = Math.min(maxImages || 10, state.screenshots.length);
          const images = [];
          for (let i = 0; i < limit; i++) {
            const s = state.screenshots[i];
            if (!s) continue;
            const src = getLocalizedImageSrc(s, lang);
            if (!src) continue;
            const sizeKB = Math.round(src.length / 1024);
            images.push({
              index: i,
              name: s.name || `Screenshot ${i + 1}`,
              language: lang,
              dataUrlLength: src.length,
              sizeKB,
              dataUrl: sizeKB < 800 ? src : null,
              truncated: sizeKB >= 800
            });
          }
          return {
            language: lang,
            count: images.length,
            totalScreenshots: state.screenshots.length,
            images,
            hint: images.some(r => r.truncated) ? 'Some images truncated due to size. Call get_images with screenshotIndex for the full image.' : undefined
          };
        }
      },
      {
        name: 'manage_elements',
        description: 'Manage floating overlay elements (badges, labels — NOT headlines; use set_text_content for those). Actions: add (needs text — adds a text badge to screenshotIndex or selected; optional language, x, y, font, fontSize, fontColor #rrggbb, fontWeight), update (needs elementId — optional screenshotIndex to skip searching, optional text+language to set per-language text, optional properties object: x, y, width, rotation, opacity, layer [behind-screenshot|above-screenshot|above-text], font, fontSize, fontWeight, fontColor, italic, frame, frameColor, frameScale, iconColor, iconStrokeWidth), delete (needs elementId). Element ids are in get_app_state current.elements.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['add', 'update', 'delete'] },
            elementId: { type: 'string', description: 'For update/delete' },
            screenshotIndex: { type: 'integer', minimum: 0 },
            text: { type: 'string', description: 'For add (required) / update (with language)' },
            language: { type: 'string', description: 'Language for text' },
            x: { type: 'number', minimum: 0, maximum: 100 },
            y: { type: 'number', minimum: 0, maximum: 100 },
            font: { type: 'string' },
            fontSize: { type: 'number', minimum: 10, maximum: 300 },
            fontColor: { type: 'string' },
            fontWeight: { type: 'string' },
            properties: { type: 'object', description: 'For update: property updates', additionalProperties: true }
          },
          required: ['action'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async (args, { signal }) => {
          checkAborted(signal);
          const { action, elementId, screenshotIndex } = args;
          if (action === 'add') {
            if (typeof args.text !== 'string' || !args.text) throw new Error('action "add" requires text');
            if (typeof addTextElement !== 'function') throw new Error('addTextElement not available');
            const lang = args.language || state.currentLanguage;
            if (!isLanguageCodeValid(lang)) throw new Error(`Invalid language "${lang}"`);
            if (args.fontColor !== undefined && !isHexColor(args.fontColor)) throw new Error(`Invalid fontColor "${args.fontColor}"`);
            const idx = resolveTargetIndex(screenshotIndex);
            const prevSelected = state.selectedIndex;
            state.selectedIndex = idx;
            try {
              addTextElement();
            } catch (e) {
              state.selectedIndex = prevSelected;
              throw e;
            }
            const s = state.screenshots[idx];
            const el = (s.elements || [])[s.elements.length - 1];
            if (!el) { state.selectedIndex = prevSelected; throw new Error('Failed to create text element'); }
            el.texts = { [lang]: args.text };
            el.text = args.text;
            if (args.x !== undefined) el.x = args.x;
            if (args.y !== undefined) el.y = args.y;
            if (args.font !== undefined) el.font = args.font;
            if (args.fontSize !== undefined) el.fontSize = args.fontSize;
            if (args.fontColor !== undefined) el.fontColor = args.fontColor;
            if (args.fontWeight !== undefined) el.fontWeight = args.fontWeight;
            if (args.font && typeof loadGoogleFont === 'function') {
              try { await loadGoogleFont(args.font); } catch (e) { /* fallback */ }
            }
            syncAll();
            await persist();
            return { success: true, action, elementId: el.id, screenshotIndex: idx };
          }
          if (action === 'update') {
            if (!elementId) throw new Error('action "update" requires elementId');
            const found = findElementTarget(elementId, screenshotIndex);
            const element = found.element;
            if (args.text !== undefined) {
              const lang = args.language || state.currentLanguage;
              if (!isLanguageCodeValid(lang)) throw new Error(`Invalid language "${lang}"`);
              if (!element.texts) element.texts = {};
              element.texts[lang] = args.text;
              if (typeof getElementText === 'function') element.text = getElementText(element);
              else element.text = args.text;
            }
            if (args.properties !== undefined) {
              const allowed = ['x', 'y', 'width', 'rotation', 'opacity', 'layer', 'text', 'font', 'fontSize', 'fontWeight', 'fontColor', 'italic', 'frame', 'frameColor', 'frameScale', 'iconColor', 'iconStrokeWidth'];
              for (const key of Object.keys(args.properties)) {
                if (!allowed.includes(key)) throw new Error(`Property "${key}" not allowed (allowed: ${allowed.join(', ')})`);
              }
              if (args.properties.fontColor !== undefined && !isHexColor(args.properties.fontColor)) throw new Error('Invalid fontColor');
              if (args.properties.frameColor !== undefined && !isHexColor(args.properties.frameColor)) throw new Error('Invalid frameColor');
              if (args.properties.iconColor !== undefined && !isHexColor(args.properties.iconColor)) throw new Error('Invalid iconColor');
              if (args.properties.layer !== undefined && !['behind-screenshot', 'above-screenshot', 'above-text'].includes(args.properties.layer)) {
                throw new Error('Invalid layer (expected behind-screenshot, above-screenshot, above-text)');
              }
              Object.assign(element, args.properties);
              if (args.properties.font && typeof loadGoogleFont === 'function') {
                try { await loadGoogleFont(args.properties.font); } catch (e) { /* fallback */ }
              }
              if (element.type === 'icon' && typeof updateIconImage === 'function' &&
                (args.properties.iconColor !== undefined || args.properties.iconStrokeWidth !== undefined)) {
                try { await updateIconImage(element); } catch (e) { /* non-critical */ }
              }
            }
            state.selectedIndex = found.index;
            if (typeof updateCanvas === 'function') updateCanvas();
            if (typeof updateElementsList === 'function') updateElementsList();
            await persist();
            return { success: true, action, elementId, screenshotIndex: found.index };
          }
          if (action === 'delete') {
            if (!elementId) throw new Error('action "delete" requires elementId');
            const found = findElementTarget(elementId, screenshotIndex);
            found.screenshot.elements = (found.screenshot.elements || []).filter(e => e.id !== elementId);
            state.selectedIndex = found.index;
            if (typeof updateCanvas === 'function') updateCanvas();
            if (typeof updateElementsList === 'function') updateElementsList();
            await persist();
            return { success: true, action, elementId, remaining: found.screenshot.elements.length };
          }
          throw new Error(`Unknown action "${action}"`);
        }
      },
      {
        name: 'manage_popouts',
        description: 'Manage magnified crop callouts (popouts) of the screenshot source image. Actions: add (screenshotIndex or selected — requires an uploaded image; fine-tune with update), update (needs popoutId — properties with crop region cropX/cropY/cropWidth/cropHeight 0-100, placement x/y/width/rotation/opacity/cornerRadius, shadow.* and border.* — dot-paths like {"shadow.blur": 20} allowed), delete (needs popoutId). Popout ids are in get_app_state current.popouts.',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['add', 'update', 'delete'] },
            popoutId: { type: 'string', description: 'For update/delete' },
            screenshotIndex: { type: 'integer', minimum: 0 },
            properties: { type: 'object', description: 'For update', additionalProperties: true }
          },
          required: ['action'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async ({ action, popoutId, screenshotIndex, properties }, { signal }) => {
          checkAborted(signal);
          if (action === 'add') {
            if (typeof addPopout !== 'function') throw new Error('addPopout not available');
            const idx = resolveTargetIndex(screenshotIndex);
            const prevSelected = state.selectedIndex;
            state.selectedIndex = idx;
            const before = new Set((state.screenshots[idx].popouts || []).map(p => p.id));
            addPopout();
            const after = state.screenshots[idx].popouts || [];
            const created = after.find(p => !before.has(p.id)) || after[after.length - 1];
            if (!created) { state.selectedIndex = prevSelected; throw new Error('Could not create popout (screenshot may have no image yet)'); }
            await persist();
            return { success: true, action, popoutId: created.id, screenshotIndex: idx };
          }
          if (action === 'update') {
            if (!popoutId) throw new Error('action "update" requires popoutId');
            const found = findPopoutTarget(popoutId, screenshotIndex);
            for (const [key, value] of Object.entries(properties || {})) {
              if (key.includes('.')) {
                const parts = key.split('.');
                let obj = found.popout;
                for (let i = 0; i < parts.length - 1; i++) {
                  if (obj[parts[i]] === undefined) obj[parts[i]] = {};
                  obj = obj[parts[i]];
                }
                obj[parts[parts.length - 1]] = value;
              } else {
                found.popout[key] = value;
              }
            }
            state.selectedIndex = found.index;
            if (typeof updateCanvas === 'function') updateCanvas();
            await persist();
            return { success: true, action, popoutId, screenshotIndex: found.index };
          }
          if (action === 'delete') {
            if (!popoutId) throw new Error('action "delete" requires popoutId');
            const found = findPopoutTarget(popoutId, screenshotIndex);
            found.screenshot.popouts = (found.screenshot.popouts || []).filter(p => p.id !== popoutId);
            state.selectedIndex = found.index;
            if (typeof updateCanvas === 'function') updateCanvas();
            await persist();
            return { success: true, action, popoutId, remaining: found.screenshot.popouts.length };
          }
          throw new Error(`Unknown action "${action}"`);
        }
      },
      {
        name: 'set_output_size',
        description: 'Set the App Store export size for the whole project (e.g. iphone-6.9 1320x2868, iphone-6.7, ipad-12.9, android-phone, or custom with customWidth+customHeight). See ids in get_app_state project.availableOutputSizes. Applies to all screenshots and exports.',
        inputSchema: {
          type: 'object',
          properties: {
            outputDevice: { type: 'string', description: 'Size id or "custom"' },
            customWidth: { type: 'integer', minimum: 100, maximum: 4000 },
            customHeight: { type: 'integer', minimum: 100, maximum: 4000 }
          },
          required: ['outputDevice'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async ({ outputDevice, customWidth, customHeight }, { signal }) => {
          checkAborted(signal);
          const known = (typeof deviceDimensions !== 'undefined') ? Object.keys(deviceDimensions) : [];
          if (outputDevice !== 'custom' && !known.includes(outputDevice)) {
            throw new Error(`Unknown outputDevice "${outputDevice}" (known: ${known.join(', ')}, custom)`);
          }
          if (outputDevice === 'custom') {
            if (!customWidth || !customHeight) throw new Error('customWidth and customHeight are required for custom size');
            state.customWidth = customWidth;
            state.customHeight = customHeight;
          }
          state.outputDevice = outputDevice;
          syncAll();
          await persist();
          const dims = getDims();
          return { success: true, outputDevice, width: dims.width, height: dims.height };
        }
      },
      {
        name: 'export',
        description: 'Render FULL-resolution PNGs for upload to App Store Connect — the agent saves each returned dataUrl to a file (e.g. screenshot-1.png). With screenshotIndex renders that one screenshot (defaults to selected); without it renders ALL screenshots. Optional language (defaults to current). Saved state is left untouched.',
        inputSchema: {
          type: 'object',
          properties: {
            screenshotIndex: { type: 'integer', minimum: 0, description: 'Optional; when omitted, exports all screenshots' },
            language: { type: 'string', description: 'Optional; defaults to current language' }
          },
          additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async ({ screenshotIndex, language } = {}, { signal } = {}) => {
          checkAborted(signal);
          if (state.screenshots.length === 0) throw new Error('No screenshots to export');
          const lang = language || state.currentLanguage;
          if (language && !state.projectLanguages.includes(language)) {
            throw new Error(`Language "${language}" not in project (${state.projectLanguages.join(', ')})`);
          }
          if (typeof screenshotIndex === 'number') {
            const idx = resolveTargetIndex(screenshotIndex);
            const rendered = renderExportDataUrl(idx, lang);
            checkAborted(signal);
            return {
              mode: 'single',
              index: idx,
              name: state.screenshots[idx].name,
              filename: `screenshot-${idx + 1}.png`,
              language: rendered.language,
              width: rendered.width,
              height: rendered.height,
              sizeKB: Math.round(rendered.dataUrl.length / 1024),
              dataUrl: rendered.dataUrl
            };
          }
          const dims = getDims();
          const exports = [];
          for (let i = 0; i < state.screenshots.length; i++) {
            checkAborted(signal);
            const rendered = renderExportDataUrl(i, lang);
            exports.push({
              index: i,
              filename: `screenshot-${i + 1}.png`,
              sizeKB: Math.round(rendered.dataUrl.length / 1024),
              dataUrl: rendered.dataUrl
            });
          }
          return {
            mode: 'all',
            language: lang,
            width: dims.width,
            height: dims.height,
            count: exports.length,
            totalSizeKB: exports.reduce((a, e) => a + e.sizeKB, 0),
            exports
          };
        }
      },
      {
        name: 'transfer_style',
        description: 'Copy the full design (background, device layout, text styling, elements) from one screenshot to another screenshot or to all others. Text CONTENT on targets is preserved — only styling is copied. Popouts are intentionally not copied (crop regions are image-specific).',
        inputSchema: {
          type: 'object',
          properties: {
            sourceIndex: { type: 'integer', minimum: 0 },
            targetIndex: {
              description: 'Target screenshot index, or "all" for every other screenshot',
              anyOf: [{ type: 'integer', minimum: 0 }, { type: 'string', enum: ['all'] }]
            }
          },
          required: ['sourceIndex', 'targetIndex'],
          additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async ({ sourceIndex, targetIndex }, { signal }) => {
          checkAborted(signal);
          if (typeof transferStyle !== 'function') throw new Error('transferStyle not available');
          if (sourceIndex < 0 || sourceIndex >= state.screenshots.length) {
            throw new Error(`Invalid sourceIndex ${sourceIndex}`);
          }
          let targets = [];
          if (targetIndex === 'all') {
            targets = state.screenshots.map((_, i) => i).filter(i => i !== sourceIndex);
          } else if (typeof targetIndex === 'number') {
            if (targetIndex < 0 || targetIndex >= state.screenshots.length) throw new Error(`Invalid targetIndex ${targetIndex}`);
            if (targetIndex === sourceIndex) throw new Error('sourceIndex and targetIndex must differ');
            targets = [targetIndex];
          } else {
            throw new Error('targetIndex must be a screenshot index or "all"');
          }
          for (const t of targets) {
            checkAborted(signal);
            transferStyle(sourceIndex, t);
          }
          syncAll();
          await persist();
          return { success: true, sourceIndex, targets };
        }
      }
    ];
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  let alreadyRegistered = false;
  async function registerAll() {
    if (alreadyRegistered) return;
    if (typeof document === 'undefined') return;
    const modelContext = document.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== 'function') {
      // Not a WebMCP-capable browser — silent no-op (manual editing still works)
      return;
    }
    if (!hasRequiredGlobals()) {
      // App not yet initialized — retry shortly
      setTimeout(registerAll, 300);
      return;
    }
    alreadyRegistered = true;

    const defs = getToolsDefinitions();
    let ok = 0;
    for (const def of defs) {
      try {
        await modelContext.registerTool({
          name: def.name,
          description: def.description,
          inputSchema: def.inputSchema,
          annotations: def.annotations,
          execute: def.execute
        });
        ok++;
      } catch (e) {
        // Duplicate registration (e.g. HMR) or invalid schema — warn but continue
        console.warn(`[WebMCP] registerTool failed for "${def.name}":`, e.message || e);
      }
    }
    console.info(`[WebMCP] Registered ${ok}/${defs.length} tools`);
    if (typeof window !== 'undefined') {
      window.__webmcpTools = defs.map(d => d.name);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerAll);
  } else {
    setTimeout(registerAll, 200);
  }

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
