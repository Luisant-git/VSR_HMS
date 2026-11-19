/**
 * Recalculate pending late fines for every student of one college in production.
 *
 * Unlike the nightly cron, this script does NOT skip students whose
 * Student.feeStatus is 'Paid'. It uses the live transaction ledger and the new
 * rule that the due date itself is NOT an overdue day.
 *
 * Usage (from the backend folder, after `npm run build`):
 *   node recalculate-college-fines.js                 # DRY RUN for SSM
 *   node recalculate-college-fines.js --apply         # apply for SSM
 *   node recalculate-college-fines.js SEASIND --apply # apply for another college
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const COLLEGE = process.argv.find(
  arg => !arg.startsWith('--') && !arg.endsWith('.js') && arg !== process.execPath,
) || 'SSM';

const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100;
const startOfDay = value => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};
const fineKeyFrom = description => {
  const match = /late fine accumulation\s*-\s*(rent|mess|eb)\b/i.exec(String(description || ''));
  return match ? match[1].toLowerCase() : null;
};
const daysFromDescription = description => {
  const match = /for\s+(\d+)\s+days?\s+overdue/i.exec(String(description || ''));
  return match ? Number(match[1]) : 0;
};
const isLateFine = fee =>
  String(fee?.transactionType || '').toUpperCase() === 'FINE' &&
  /late fine accumulation/i.test(String(fee?.description || ''));

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Load the production environment before running this script.');
  }

  console.log('=================================================================');
  console.log(`--- Recalculate college late fines ${APPLY ? '[APPLY]' : '[DRY RUN - NO CHANGES]'} ---`);
  console.log('=================================================================');

  const exactColleges = await prisma.college.findMany({
    where: {
      OR: [
        { name: { equals: COLLEGE, mode: 'insensitive' } },
        { shortName: { equals: COLLEGE, mode: 'insensitive' } },
      ],
    },
    include: { fineMaster: true },
  });
  const colleges = exactColleges.length > 0
    ? exactColleges
    : await prisma.college.findMany({
        where: {
          OR: [
            { name: { contains: COLLEGE, mode: 'insensitive' } },
            { shortName: { contains: COLLEGE, mode: 'insensitive' } },
          ],
        },
        include: { fineMaster: true },
      });
  if (colleges.length === 0) throw new Error(`College "${COLLEGE}" was not found. Nothing was changed.`);
  if (colleges.length > 1) {
    console.table(colleges.map(c => ({ id: c.id, name: c.name, shortName: c.shortName })));
    throw new Error(`College "${COLLEGE}" is ambiguous (${colleges.length} matches). Nothing was changed.`);
  }

  const college = colleges[0];
  const rates = {
    rent: Number(college.fineMaster?.rentFine) || 0,
    mess: Number(college.fineMaster?.messFine) || 0,
    eb: Number(college.fineMaster?.ebFine) || 0,
  };
  if (!rates.rent && !rates.mess && !rates.eb) {
    throw new Error(`College "${college.name}" has no Fine Master rates configured. Nothing was changed.`);
  }

  console.log(`College: ${college.name} (${college.id})`);
  console.log(`Rates: Rent ₹${rates.rent}/day, Mess ₹${rates.mess}/day, EB ₹${rates.eb}/day`);

  const students = await prisma.student.findMany({
    where: { collegeId: college.id, status: { not: 'Vacated' } },
    include: {
      transactions: {
        where: {
          OR: [{ status: 'PENDING' }, { status: 'COMPLETED', transactionType: 'FINE' }],
        },
      },
    },
    orderBy: { regNo: 'asc' },
  });
  console.log(`Active students found: ${students.length}`);

  const today = startOfDay(new Date());
  const configs = [
    { key: 'rent', types: ['RENT', 'ADVANCE'], rate: rates.rent },
    { key: 'mess', types: ['MESS'], rate: rates.mess },
    { key: 'eb', types: ['EB_BILL'], rate: rates.eb },
  ];

  const changes = [];
  for (const student of students) {
    const transactions = student.transactions || [];
    const pending = transactions.filter(t => t.status === 'PENDING');
    const paidByType = { rent: 0, mess: 0, eb: 0 };
    transactions
      .filter(t => t.status === 'COMPLETED' && isLateFine(t))
      .forEach(t => {
        const key = fineKeyFrom(t.description);
        if (key) paidByType[key] = roundMoney(paidByType[key] + (Number(t.amount) || 0));
      });

    for (const config of configs) {
      if (config.rate <= 0) continue;

      const parents = pending.filter(t =>
        config.types.includes(String(t.transactionType || '').toUpperCase()),
      );
      const typedRows = pending.filter(t => isLateFine(t) && fineKeyFrom(t.description) === config.key);
      if (parents.length === 0 && typedRows.length === 0) continue;

      const dueDates = parents.filter(t => t.dueDate).map(t => startOfDay(t.dueDate));
      const due = dueDates.length > 0
        ? dueDates.reduce((oldest, current) => (current < oldest ? current : oldest))
        : college.dueDate ? startOfDay(college.dueDate) : null;
      if (!due) continue;

      const days = today <= due ? 0 : Math.floor((today.getTime() - due.getTime()) / 86_400_000);
      const target = roundMoney(Math.max(0, days * config.rate - paidByType[config.key]));
      const existing = roundMoney(typedRows.reduce((sum, t) => sum + (Number(t.amount) || 0), 0));
      const storedDays = typedRows.reduce((max, t) => Math.max(max, daysFromDescription(t.description)), 0);

      if (existing !== target || storedDays !== days) {
        changes.push({
          regNo: student.regNo,
          name: student.name,
          feeStatus: student.feeStatus,
          type: config.key,
          storedDays,
          newDays: days,
          oldAmount: `₹${existing.toLocaleString('en-IN')}`,
          newAmount: `₹${target.toLocaleString('en-IN')}`,
        });
      }
    }
  }

  console.log(`\nStale fine rows found: ${changes.length}`);
  if (changes.length > 0) {
    console.table(changes.slice(0, 200));
    if (changes.length > 200) console.log(`...and ${changes.length - 200} more.`);
  }

  if (!APPLY) {
    console.log('\nDRY RUN: no database changes were made.');
    console.log('To apply, rerun with: node recalculate-college-fines.js --apply');
    return;
  }

  // Reuse the exact cron implementation so the bulk fix and future cron runs
  // stay in sync. The compiled service is a normal JS class at runtime.
  let FineCronService;
  try {
    ({ FineCronService } = require('./dist/students/fine-cron.service'));
  } catch {
    throw new Error('Compiled cron service not found. Run "npm run build" first.');
  }

  const service = new FineCronService(prisma);
  for (const student of students) {
    await service.applyStudentFines(student, rates, today, college.dueDate);
  }

  console.log(`\nDone. Recalculated fines for ${students.length} students of ${college.name}.`);
  console.log('Students with feeStatus = Paid were included; the ledger decides whether a fine is due.');
}

main()
  .catch(error => {
    console.error('\nRecalculation failed:', error.message);
    console.error('No changes were made unless an APPLY run printed a success message above.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
