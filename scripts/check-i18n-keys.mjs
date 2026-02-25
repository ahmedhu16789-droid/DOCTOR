import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = process.cwd();
const localeRoot = path.join(repoRoot, 'src/locales');
const localeFilesByLang = {
  en: ['common.ts', 'admin.ts', 'booking.ts', 'medical.ts'].map((f) => path.join(localeRoot, 'en', f)),
  ar: ['common.ts', 'admin.ts', 'booking.ts', 'medical.ts'].map((f) => path.join(localeRoot, 'ar', f)),
};

// Start with the known high-risk screens for missing keys, can be expanded over time.
const filesToCheck = [
  'pages/Login.tsx',
  'pages/DoctorWorkspace.tsx',
  'components/ReceptionQueue.tsx',
  'components/dashboard/AppointmentChart.tsx',
  'components/forms/ScheduleGrid.tsx',
  'pages/AppointmentBooking.tsx',
];

const flattenKeys = (obj, prefix = '', keys = new Set()) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return keys;
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenKeys(value, next, keys);
    } else {
      keys.add(next);
    }
  }
  return keys;
};

const loadLocaleExports = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const normalized = source.replace(/export\s+const\s+/g, 'const ');
  const names = [...normalized.matchAll(/const\s+([A-Za-z0-9_]+)\s*=/g)].map((m) => m[1]);
  const scriptBody = `${normalized}\nmodule.exports = { ${names.join(', ')} };`;
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports });
  new vm.Script(scriptBody, { filename: filePath }).runInContext(context);
  return module.exports;
};

const extractTKeys = (content) => {
  const keys = [];
  const tRegex = /\bt\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = tRegex.exec(content)) !== null) keys.push(match[1]);
  return keys;
};

const localeKeysByLang = {};
for (const [lang, files] of Object.entries(localeFilesByLang)) {
  const keySet = new Set();
  for (const file of files) {
    const exportsObj = loadLocaleExports(file);
    for (const value of Object.values(exportsObj)) flattenKeys(value, '', keySet);
  }
  localeKeysByLang[lang] = keySet;
}

const keyUsage = new Map();
for (const relPath of filesToCheck) {
  const filePath = path.join(repoRoot, relPath);
  const content = fs.readFileSync(filePath, 'utf8');
  for (const key of extractTKeys(content)) {
    if (!keyUsage.has(key)) keyUsage.set(key, new Set());
    keyUsage.get(key).add(relPath);
  }
}

let hasErrors = false;
for (const [lang, localeKeys] of Object.entries(localeKeysByLang)) {
  const missing = [];
  for (const [key, files] of keyUsage.entries()) {
    if (!localeKeys.has(key)) missing.push({ key, files: [...files].sort() });
  }

  if (missing.length === 0) {
    console.log(`✅ ${lang}: all checked i18n keys exist.`);
    continue;
  }

  hasErrors = true;
  missing.sort((a, b) => a.key.localeCompare(b.key));
  console.error(`❌ ${lang}: missing ${missing.length} key(s):`);
  for (const item of missing) {
    console.error(`  - ${item.key}`);
    for (const file of item.files) console.error(`      • ${file}`);
  }
}

if (hasErrors) process.exit(1);
