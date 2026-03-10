const fs = require('fs');
const src = fs.readFileSync('App.js', 'utf8');
const lines = src.split('\n');
let d = 0, on = false;
lines.forEach((l, i) => {
  if (l.includes('export default function App()')) on = true;
  if (!on) return;
  for (const c of l) {
    if (c === '{') d++;
    if (c === '}') d--;
  }
  if (on && i > 57 && d === 0) {
    console.log('closes at line', i + 1, l.trim().slice(0, 50));
    on = false;
  }
});
console.log('final depth', d);
