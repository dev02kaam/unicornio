const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('student dashboard loads the audiovisual instruction sequence', () => {
  const dashboard = fs.readFileSync(path.join(root, 'public', 'dashboard.html'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'public', 'css', 'student-instructions.css'), 'utf8');
  assert.match(dashboard, /\/css\/student-instructions\.css/);
  assert.match(dashboard, /\/js\/student-instructions\.js/);
  assert.match(styles, /\/assets\/onboarding\/school-hall-v3\.webp/);
  assert.ok(fs.statSync(path.join(root, 'public', 'assets', 'onboarding', 'school-hall-v3.webp')).size > 0);
});

test('student instructions use the correct age pairs and speaking order', () => {
  const source = fs.readFileSync(path.join(root, 'public', 'js', 'student-instructions.js'), 'utf8');
  assert.match(source, /junior:\s*\[\s*\{ id: 'nico'/);
  assert.match(source, /\{ id: 'luna'/);
  assert.match(source, /senior:\s*\[\s*\{ id: 'orion'/);
  assert.match(source, /\{ id: 'sol'/);
  assert.match(source, /String\(user\.role \|\| ''\)\.toUpperCase\(\) !== 'STUDENT'/);
  assert.match(source, /startStep\(0, user\)/);
  assert.match(source, /currentStep === 0/);
});

test('all instruction characters have transparent video, poster, audio and idle media', () => {
  for (const character of ['nico', 'luna', 'orion', 'sol']) {
    const directory = path.join(root, 'public', 'assets', 'companions', character);
    for (const filename of [
      'instructions-speaking-transparent.webm',
      'instructions-speaking-poster.webp',
      'instructions-speaking.mp3',
      'question-idle-transparent.webm',
      'question-idle-poster.webp',
    ]) {
      const asset = path.join(directory, filename);
      // The character and filename values come from the fixed allowlists above.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      assert.ok(fs.existsSync(asset), `${character}/${filename} is missing`);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      assert.ok(fs.statSync(asset).size > 0, `${character}/${filename} is empty`);
    }
  }
});

test('login resets the per-session instruction marker for students', () => {
  const login = fs.readFileSync(path.join(root, 'public', 'js', 'login.js'), 'utf8');
  assert.match(login, /unicornio_student_instructions_seen:/);
  assert.match(login, /sessionStorage\.removeItem/);
});
