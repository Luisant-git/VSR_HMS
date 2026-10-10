const fs = require('fs');
let f = fs.readFileSync('c:/Users/Administrator/Desktop/Hostel/VSR_HMS/backend/prisma/seed-canteen.ts', 'utf8');
let cnt = 1;
f = f.replace(/code:\s*'[^']+'/g, () => `code: 'P${String(cnt++).padStart(6, '0')}'`);
fs.writeFileSync('c:/Users/Administrator/Desktop/Hostel/VSR_HMS/backend/prisma/seed-canteen.ts', f);
