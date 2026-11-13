import { IsArray, IsBoolean, IsOptional } from 'class-validator';

/**
 * One row from the Fees Excel sheet.
 *
 * `studentKey` is the value shown in the "Student ID" column, i.e. either the
 * student's `regNo` or `manualRegsiName`. Amounts are optional: a missing value
 * means "leave this category unchanged", while 0 means "remove this due".
 */
export interface ImportFeeRowInput {
  studentKey: string;
  rent?: number | string | null;
  eb?: number | string | null;
  fine?: number | string | null;
  advance?: number | string | null;
}

export class ImportFeesDto {
  @IsArray()
  rows: ImportFeeRowInput[];

  /**
   * When true the service only reports what would change and writes nothing.
   * The Fees page uses this to show a preview before the admin confirms.
   */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
