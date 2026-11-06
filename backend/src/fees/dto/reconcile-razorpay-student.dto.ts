import { IsUUID } from 'class-validator';

export class ReconcileRazorpayStudentDto {
  @IsUUID()
  studentId: string;
}
