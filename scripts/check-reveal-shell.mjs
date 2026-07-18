import { readFileSync } from 'node:fs';

const reveal = readFileSync('reveal.html', 'utf8');
const index = readFileSync('index.html', 'utf8');
const script = /<script\s+type="module"\s+src="([^"]+)"/.exec(reveal)?.[1];
if (script !== '/src/main.js') throw new Error(`reveal.html must load /src/main.js, found ${script || 'none'}`);
if (!reveal.includes('background-color: #000000')) throw new Error('reveal.html is missing critical #000000 background style.');
if (/Maintenance/i.test(reveal)) throw new Error('reveal.html must not be the maintenance shell.');
if (!/Maintenance/i.test(index) && index.includes('<script type="module"')) {
  const indexScript = /<script\s+type="module"\s+src="([^"]+)"/.exec(index)?.[1];
  if (indexScript !== script) throw new Error(`index.html entry ${indexScript} diverges from reveal.html ${script}`);
}
console.log('reveal shell ok');
