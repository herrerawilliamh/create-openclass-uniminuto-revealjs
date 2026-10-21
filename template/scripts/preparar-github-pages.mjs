import fs from 'node:fs';
const checks = ['index.html','general/index.html','slides.md','openclass.config.json','.github/workflows/deploy.yml'];
for (const f of checks) { if (!fs.existsSync(f)) { console.error(`FALTA=${f}`); process.exitCode=1; } else console.log(`PASS=${f}`); }
if (!process.exitCode) console.log('GITHUB_PAGES_PRECHECK=PASS');
