const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const roundMoney = (v) => Math.round((Number(v) || 0) * 100) / 100;
const EPS = 0.005;

const STUDENTS = [
  { name: 'SUMAIYA BEGUM.M', mobileNo: '9597733288', outstanding: 86600, billingMonth: '2026-11' },
  { name: 'SNEKHA.S', mobileNo: '8754607398', outstanding: 3125 },
  { name: 'ABIRA BINU', mobileNo: '9270512115', outstanding: 5250 },
  { name: 'SIVAPRIYA.K', mobileNo: '9633414825', outstanding: 8250 },
  { name: 'PRAVANA PRAKASH', mobileNo: '9497395130', outstanding: 3750 },
  { name: 'KASHMEERA BABU', mobileNo: '6282924338', outstanding: 3750 },
  { name: 'LAKSHMI SANTHOSH', mobileNo: '8921898172', outstanding: 10250 },
  { name: 'NESRIN.A', mobileNo: '9074343524', outstanding: 6750 },
  { name: 'SANA FATHIMA.A', mobileNo: '8136863726', outstanding: 8500 },
  { name: 'SEENA.M', mobileNo: '9544669674', outstanding: 8500 },
  { name: 'SHADA SHEERIN.K.P', mobileNo: '9249046354', outstanding: 8500 },
  { name: 'ALEENA SUSAN SHIBU', mobileNo: '8592965392', outstanding: 4250 },
  { name: 'SANIYYA.PA', mobileNo: '8593972120', outstanding: 8500 },
  { name: 'ARABHI.A.K', mobileNo: '6238141930', outstanding: 7500 },
  { name: 'SREE NANDHA.A', mobileNo: '9495955160', outstanding: 6250 },
  { name: 'NIVEDITHA.N', mobileNo: '8921578836', outstanding: 3750 },
  { name: 'IFAH HUSSAIN', mobileNo: '9746457460', outstanding: 4250 },
  { name: 'FIDHA K.S', mobileNo: '9526633637', outstanding: 8250 },
  { name: 'FEBA SHAREEFA', mobileNo: '9544362464', outstanding: 8500 },
  { name: 'JUBY ANN MATHEW', mobileNo: '7012189523', outstanding: 8500 },
  { name: 'AMRUTHA SURESH', mobileNo: '7306622367', outstanding: 4250 },
  { name: 'SUJANNYA K.SHAJI', mobileNo: '8714417323', outstanding: 8500 },
  { name: 'HAIFA.A', mobileNo: '8075948134', outstanding: 8500 },
  { name: 'DEVIKA.A', mobileNo: '8136818172', outstanding: 4250 },
  { name: 'SHAHANI MARIYAM ,P', mobileNo: '8156893159', outstanding: 8500 },
  { name: 'JOHANNA MERRY MATHEW', mobileNo: '9526877100', outstanding: 4250 },
  { name: 'HANNAH MARIA JOSY', mobileNo: '6282468359', outstanding: 4250 },
  { name: 'SANA FATHIMA.M.C', mobileNo: '9745418063', outstanding: 8500 },
  { name: 'NAURIN.N.S', mobileNo: '8129919859', outstanding: 8500 },
  { name: 'HIBA.P.J', mobileNo: '8848535302', outstanding: 8500 },
  { name: 'NASHWA.K', mobileNo: '8590975527', outstanding: 8500 },
  { name: 'RAINA SHIJU', mobileNo: '8137816667', outstanding: 4250 },
  { name: 'HANEENA FATHIMA', mobileNo: '8137031524', outstanding: 3750 },
  { name: 'KAVITHA.E', mobileNo: '8098804729', outstanding: 8500 },
  { name: 'AYEESHA SIMIN', mobileNo: '8086619145', outstanding: 30000 },
  { name: 'PARVATHI SREEKUMAR', mobileNo: '9043821395', outstanding: 8250 },
  { name: 'SAKTHI.V', mobileNo: '9585142132', outstanding: 7500, clearRentPaidUntil: true },
  { name: 'NESHWA.N', mobileNo: '9188480492', outstanding: 8500 },
  { name: 'FATHIMA HANAN ABDUL GAFOOR', mobileNo: '9947175441', outstanding: 8500 },
  { name: 'JEBA JENITA PEARLIN', mobileNo: '9080668589', outstanding: 7500 },
  { name: 'KARTHIKA.T.U', mobileNo: '8086360154', outstanding: 7500 },
  { name: 'FATHIMA NAFIA.P', mobileNo: '7510875646', outstanding: 8500 },
];

async function setOutstandingForStudent(student, targetRemaining, targetBillingMonth = '2026-12') {
  await prisma.$transaction(async (tx) => {
    const outstandingInvoices = await tx.feeTransaction.findMany({
      where: {
        studentId: student.id,
        status: 'PENDING',
        deletedAt: null,
        transactionType: { notIn: ['MESS', 'MESS DEDUCTION'] },
        description: { startsWith: 'Outstanding', mode: 'insensitive' },
      },
      orderBy: { createdAt: 'asc' },
    });

    const confirmedPayments = await tx.feeTransaction.findMany({
      where: {
        studentId: student.id,
        status: 'COMPLETED',
        deletedAt: null,
        transactionType: 'OUTSTANDING_PAYMENT',
      },
      select: { amount: true },
    });

    const originalOutstanding = roundMoney(
      outstandingInvoices.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    );
    const previouslyPaid = roundMoney(
      confirmedPayments.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    );
    const currentRemaining = roundMoney(Math.max(0, originalOutstanding - previouslyPaid));
    const target = roundMoney(targetRemaining);

    if (targetBillingMonth && outstandingInvoices.length > 0) {
      await tx.feeTransaction.updateMany({
        where: { id: { in: outstandingInvoices.map((inv) => inv.id) } },
        data: { billingMonth: targetBillingMonth },
      });
    }

    if (Math.abs(target - currentRemaining) < EPS) {
      console.log(`UNCHANGED: ${student.name} (${student.mobileNo}) [${targetBillingMonth}] -> ₹${currentRemaining}`);
      return;
    }

    const delta = roundMoney(target - currentRemaining);
    if (delta > 0) {
      await tx.feeTransaction.create({
        data: {
          studentId: student.id,
          transactionType: 'RENT',
          amount: delta,
          status: 'PENDING',
          billingMonth: targetBillingMonth,
          description: 'Outstanding Balance (adjusted from fees sheet)',
        },
      });
    } else {
      let toReduce = roundMoney(-delta);
      for (let idx = outstandingInvoices.length - 1; idx >= 0 && toReduce > EPS; idx -= 1) {
        const inv = outstandingInvoices[idx];
        const amt = roundMoney(Number(inv.amount) || 0);
        if (amt <= 0) continue;
        if (amt <= toReduce + EPS) {
          toReduce = roundMoney(toReduce - amt);
          await tx.feeTransaction.delete({ where: { id: inv.id } });
        } else {
          await tx.feeTransaction.update({
            where: { id: inv.id },
            data: { amount: roundMoney(amt - toReduce) },
          });
          toReduce = 0;
        }
      }
    }

    if (target > 0) {
      await tx.student.update({
        where: { id: student.id },
        data: { feeStatus: 'Un-Paid' },
      });
    }

    console.log(
      `UPDATED: ${student.name} (${student.manualRegsiName || student.mobileNo}) -> ₹${currentRemaining} -> ₹${target}`,
    );
  });
}

async function main() {
  let updated = 0;
  let notFound = 0;

  for (const item of STUDENTS) {
    const mobileWhere = {
      OR: [
        { mobileNo: item.mobileNo },
        { fatherMobileNo: item.mobileNo },
        { guardianMobileNo: item.mobileNo },
      ],
    };

    let student = await prisma.student.findFirst({
      where: { ...mobileWhere, status: { not: 'Vacated' } },
      orderBy: { createdAt: 'desc' },
    });

    if (student) {
      const vacatedDupes = await prisma.student.findMany({
        where: { mobileNo: item.mobileNo, status: 'Vacated', id: { not: student.id } },
        select: { id: true, name: true, manualRegsiName: true },
      });
      for (const dupe of vacatedDupes) {
        const res = await prisma.feeTransaction.deleteMany({
          where: {
            studentId: dupe.id,
            status: 'PENDING',
            description: 'Outstanding Balance (adjusted from fees sheet)',
          },
        });
        if (res.count > 0) {
          console.log(
            `CLEANED_DUPE: ${dupe.name} (${dupe.manualRegsiName || dupe.id}) -> removed ${res.count} mistaken outstanding row(s)`,
          );
        }
      }
    }

    if (!student) {
      student = await prisma.student.findFirst({
        where: mobileWhere,
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!student) {
      const firstWord = item.name.split(/[.\s,]+/)[0];
      if (firstWord && firstWord.length >= 4) {
        student =
          (await prisma.student.findFirst({
            where: { name: { contains: firstWord, mode: 'insensitive' }, status: { not: 'Vacated' } },
            orderBy: { createdAt: 'desc' },
          })) ||
          (await prisma.student.findFirst({
            where: { name: { contains: firstWord, mode: 'insensitive' } },
            orderBy: { createdAt: 'desc' },
          }));
      }
    }

    if (!student) {
      console.warn(`NOT FOUND: ${item.name} (${item.mobileNo})`);
      notFound += 1;
      continue;
    }

    if (item.clearRentPaidUntil && student.rentPaidUntil) {
      await prisma.student.update({
        where: { id: student.id },
        data: { rentPaidUntil: null },
      });
      console.log(`CLEARED_PAID_TILL: ${student.name} (${student.manualRegsiName || student.mobileNo}) -> rentPaidUntil=null`);
    }

    await setOutstandingForStudent(student, item.outstanding, item.billingMonth || '2026-12');
    updated += 1;
  }

  console.log(`\nSummary: processed=${updated}, notFound=${notFound}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
