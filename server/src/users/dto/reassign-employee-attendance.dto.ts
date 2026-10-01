import { IsUUID } from 'class-validator';

export class ReassignEmployeeAttendanceDto {
  @IsUUID()
  sourceEmployeeId!: string;
}
