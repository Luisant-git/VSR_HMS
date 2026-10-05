const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const students = await prisma.student.findMany();
  let count = 0;
  for (const s of students) {
    if (s.rent && s.rent > 2000) {
      // First, check if they already have a MESS transaction
      const messTx = await prisma.feeTransaction.findFirst({
        where: {
          studentId: s.id,
          transactionType: 'MESS'
        }
      });
      
      // ONLY apply the fix if they don't have a mess fee, or if it's currently 0
      if (!messTx || messTx.amount === 0) {
        const newRent = s.rent - 2000;
        
        // Update student rent
        await prisma.student.update({
          where: { id: s.id },
          data: { rent: newRent }
        });
        
        // Update RENT transactions
        await prisma.feeTransaction.updateMany({
          where: {
            studentId: s.id,
            transactionType: 'RENT',
            amount: s.rent
          },
          data: {
            amount: newRent
          }
        });
        
        if (!messTx) {
          // Create MESS transaction
          await prisma.feeTransaction.create({
            data: {
               studentId: s.id,
               transactionType: 'MESS',
               amount: 2000,
               status: 'PENDING',
               description: 'Month 1 Mess Fee (Imported)'
            }
          });
        } else {
          // Update existing MESS transaction if amount is 0
          await prisma.feeTransaction.update({
             where: { id: messTx.id },
             data: { amount: 2000 }
          });
        }
        count++;
      }
    }
  }
  console.log('Fixed ' + count + ' students.');
}

fix().catch(console.error).finally(() => prisma.$disconnect());
