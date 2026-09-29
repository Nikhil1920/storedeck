const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const webmcpSource = fs.readFileSync(path.join(__dirname, '..', 'webmcp.js'), 'utf8');

async function createHarness(options = {}) {
  const tools = new Map();
  const events = new Map();
  const canvases = [];
  const renders = [];
  const state = {
    selectedIndex: 1,
    currentLanguage: 'en',
    projectLanguages: ['en', 'de'],
    screenshots: [0, 1, 2].map(index => ({
      name: `Screen ${index}`,
      screenshot: { use3D: false },
      text: { headlines: { en: 'Cast', de: 'Übertragen' }, currentHeadlineLang: 'en', languageSettings: {} },
      localizedImages: { en: { src: 'data:image/png;base64,b3JpZ2luYWw=' } }
    }))
  };
  const context = vm.createContext({
    state,
    languageNames: { en: 'English', de: 'German' },
    languageFlags: { en: 'en', de: 'de' },
    document: {
      readyState: 'loading',
      fonts: { ready: options.fontReady || Promise.resolve() },
      modelContext: { registerTool: definition => tools.set(definition.name, definition) },
      addEventListener: (name, callback) => events.set(name, callback),
      createElement: name => {
        assert.equal(name, 'canvas');
        const canvas = {
          width: 0, height: 0, style: {}, draws: [],
          getContext: () => ({ drawImage: (...args) => canvas.draws.push(args) }),
          toDataURL: () => `data:image/png;base64,${Buffer.from(`${canvas.width}x${canvas.height}`).toString('base64')}`
        };
        canvases.push(canvas);
        return canvas;
      }
    },
    window: {},
    console: { info() {}, warn() {} },
    DOMException,
    setTimeout, clearTimeout,
    setInterval: () => 0, clearInterval() {},
    getCanvasDimensions: () => options.dims || { width: 1080, height: 1920 },
    prepareThreeJSForScreenshot: options.prepare3D || (async () => {}),
    updateCanvas: () => assert.fail('Read-only rendering must not refresh/persist the UI'),
    renderScreenshotToCanvas: (index, canvas, ctx, dims) => {
      renders.push({ index, selectedIndex: state.selectedIndex, dims: { ...dims }, language: state.currentLanguage, text: structuredClone(state.screenshots[index].text) });
      // The app lazily initializes missing language layouts while rendering.
      state.screenshots[index].text.languageSettings[state.currentLanguage] = { headlineSize: 100 };
      if (options.renderError) throw new Error('Canvas render failed');
    }
  });
  vm.runInContext(webmcpSource, context);
  await events.get('DOMContentLoaded')();
  return { state, tools, canvases, renders, context };
}

test('styled previews downsample export composition and preserve project state', async () => {
  const h = await createHarness();
  const before = structuredClone(h.state);
  const originalText = h.state.screenshots[0].text;
  const result = await h.tools.get('get_images').execute({ screenshotIndex: 0, rendered: true, language: 'de' });

  assert.equal(result.rendered, true);
  assert.equal(result.width, 506);
  assert.equal(result.height, 900);
  assert.equal(result.outputWidth, 1080);
  assert.equal(result.outputHeight, 1920);
  assert.deepEqual(h.renders[0].dims, { width: 1080, height: 1920 });
  assert.equal(h.renders[0].selectedIndex, 1);
  assert.equal(h.renders[0].text.currentLayoutLang, 'de');
  assert.equal(h.renders[0].text.currentHeadlineLang, 'de');
  assert.equal(h.renders[0].text.currentSubheadlineLang, 'de');
  assert.equal(h.canvases[1].draws[0][0], h.canvases[0]);
  assert.deepEqual(h.state, before);
  assert.equal(h.state.screenshots[0].text, originalText);
});

test('preview bounds cover landscape and small compositions without upscaling', async () => {
  for (const [dims, expected] of [
    [{ width: 1920, height: 1080 }, { width: 1200, height: 675 }],
    [{ width: 320, height: 240 }, { width: 320, height: 240 }]
  ]) {
    const h = await createHarness({ dims });
    const result = await h.tools.get('get_images').execute({ screenshotIndex: 0, rendered: true, maxDimension: 1200 });
    assert.equal(result.width, expected.width);
    assert.equal(result.height, expected.height);
  }
});

test('batch previews include styled images up to the requested count', async () => {
  const h = await createHarness();
  const result = await h.tools.get('get_images').execute({ rendered: true, maxImages: 2, maxDimension: 600 });
  assert.equal(result.count, 2);
  assert.equal(result.totalScreenshots, 3);
  assert.deepEqual(Array.from(result.images, image => image.index), [0, 1]);
  assert.ok(result.images.every(image => image.height === 600 && image.dataUrl.startsWith('data:image/png;base64,')));
});

test('original image retrieval remains unchanged', async () => {
  const h = await createHarness();
  const result = await h.tools.get('get_images').execute({ screenshotIndex: 0 });
  assert.equal(result.dataUrl, h.state.screenshots[0].localizedImages.en.src);
  assert.equal(h.renders.length, 0);
});

test('full-resolution export still uses original output dimensions and restores state', async () => {
  const h = await createHarness();
  const before = structuredClone(h.state);
  const result = await h.tools.get('export').execute({ language: 'de' });
  assert.equal(result.width, 1080);
  assert.equal(result.height, 1920);
  assert.equal(result.count, 3);
  assert.equal(h.canvases.length, 3);
  assert.deepEqual(h.state, before);
});

test('render failures restore selection, language, text references and absent keys', async () => {
  const h = await createHarness({ renderError: true });
  const before = structuredClone(h.state);
  const originalText = h.state.screenshots[0].text;
  await assert.rejects(h.tools.get('get_images').execute({ screenshotIndex: 0, rendered: true, language: 'de' }), /Canvas render failed/);
  assert.deepEqual(h.state, before);
  assert.equal(h.state.screenshots[0].text, originalText);
});

test('font and 3D readiness complete before rendering or changing project selection', async () => {
  let finishFonts;
  let finishModel;
  let prepareCalled = false;
  const fontReady = new Promise(resolve => { finishFonts = resolve; });
  const modelReady = new Promise(resolve => { finishModel = resolve; });
  const h = await createHarness({ fontReady, prepare3D: () => { prepareCalled = true; return modelReady; } });
  h.state.screenshots[0].screenshot.use3D = true;
  const before = structuredClone(h.state);
  const pending = h.tools.get('get_images').execute({ screenshotIndex: 0, rendered: true, language: 'de' });
  await new Promise(setImmediate);
  assert.equal(prepareCalled, false);
  finishFonts();
  await new Promise(setImmediate);
  assert.equal(prepareCalled, true);
  assert.equal(h.renders.length, 0);
  assert.deepEqual(h.state, before);
  finishModel();
  await pending;
  assert.equal(h.renders.length, 1);
  assert.deepEqual(h.state, before);
});

test('failed or aborted model preparation never returns a misleading 2D preview', async () => {
  const failed = await createHarness({ prepare3D: () => Promise.reject(new Error('Model unavailable')) });
  failed.state.screenshots[0].screenshot.use3D = true;
  await assert.rejects(failed.tools.get('get_images').execute({ screenshotIndex: 0, rendered: true }), /Model unavailable/);
  assert.equal(failed.renders.length, 0);

  const h = await createHarness({ prepare3D: () => new Promise(() => {}) });
  h.state.screenshots[0].screenshot.use3D = true;
  const before = structuredClone(h.state);
  const controller = new AbortController();
  const pending = h.tools.get('get_images').execute({ screenshotIndex: 0, rendered: true }, { signal: controller.signal });
  await new Promise(setImmediate);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(h.renders.length, 0);
  assert.deepEqual(h.state, before);
});

test('preview limits and language are validated even without schema enforcement', async () => {
  const h = await createHarness();
  for (const maxDimension of [199, 1201, 900.5, NaN]) {
    await assert.rejects(h.tools.get('get_images').execute({ rendered: true, maxDimension }), /maxDimension/);
  }
  await assert.rejects(h.tools.get('get_images').execute({ rendered: true, maxImages: 0 }), /maxImages/);
  await assert.rejects(h.tools.get('get_images').execute({ rendered: true, language: 'fr' }), /not in project/);
  assert.equal(h.renders.length, 0);
});

test('3D preparation loads the requested cached model without switching the active one', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'three-renderer.js'), 'utf8');
  const context = vm.createContext({ document: { readyState: 'loading', addEventListener() {} } });
  vm.runInContext(source, context);
  vm.runInContext(`
    isThreeJSInitialized = true;
    threeRenderer = {};
    currentDeviceModel = 'iphone';
    phoneModelLoaded = false;
    state = { screenshots: [{ screenshot: { use3D: true, device3D: 'samsung' } }] };
    requestedModels = [];
    loadCachedPhoneModel = async type => {
      requestedModels.push(type);
      phoneModelCache[type] = { loaded: true };
    };
  `, context);
  await vm.runInContext('prepareThreeJSForScreenshot(0)', context);
  assert.deepEqual(Array.from(context.requestedModels), ['samsung']);
  assert.equal(vm.runInContext('currentDeviceModel', context), 'iphone');
  assert.equal(vm.runInContext("isPhoneModelReady('samsung')", context), true);
  await vm.runInContext('prepareThreeJSForScreenshot(0)', context);
  assert.equal(context.requestedModels.length, 1);
});
