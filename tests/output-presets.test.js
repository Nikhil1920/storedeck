const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const declaration = source.match(/const deviceDimensions = (\{[\s\S]*?\n\});/);
assert.ok(declaration, 'Output dimension presets must be defined');
const presets = vm.runInNewContext(`(${declaration[1]})`);

test('Android tablet exports fit Play Console aspect ratio and resolution limits', () => {
  for (const [id, minimum, maximum] of [
    ['android-tablet-7', 320, 3840],
    ['android-tablet-10', 1080, 7680]
  ]) {
    const { width, height } = presets[id];
    assert.equal(width * 16, height * 9, `${id} must export portrait 9:16`);
    assert.ok([width, height].every(side => Number.isInteger(side) && side >= minimum && side <= maximum),
      `${id} must respect the Play Console side-length range`);
    const label = html.match(new RegExp(`data-device="${id}"[\\s\\S]*?device-option-size">([^<]+)`));
    assert.equal(label?.[1], `${width} × ${height}`, `${id} must show the actual export dimensions`);
  }
});
