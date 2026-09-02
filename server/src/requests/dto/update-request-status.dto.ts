import { IsIn } from 'class-validator';

export class UpdateRequestStatusDto {
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status!: 'PENDING' | 'APPROVED' | 'REJECTED';
}
