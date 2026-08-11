import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { AttendanceService } from './attendance.service';
import { UpdateAttendanceStatusDto } from './dto/update-attendance-status.dto';
import { BulkAttendanceStatusDto } from './dto/bulk-attendance-status.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('scheduled-statuses')
  getScheduledStatuses(@CurrentUserDecorator() user: CurrentUser) {
    return this.attendanceService.getScheduledStatuses(user);
  }

  @Post('bulk-status')
  assignBulkStatus(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: BulkAttendanceStatusDto,
  ) {
    return this.attendanceService.assignBulkStatus(user, dto);
  }

  @Delete('scheduled-statuses/:id')
  removeScheduledStatus(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.attendanceService.removeScheduledStatus(user, id);
  }

  @Patch(':employeeId/:date/status')
  updateStatus(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('date') date: string,
    @Body() dto: UpdateAttendanceStatusDto,
  ) {
    return this.attendanceService.updateStatus(user, employeeId, date, dto);
  }
}
