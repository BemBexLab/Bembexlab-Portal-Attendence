import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import {
  DailyReportQueryDto,
  DateRangeReportQueryDto,
  LateArrivalsReportQueryDto,
  MonthlyReportQueryDto,
  OvertimeReportQueryDto,
  RawPunchesQueryDto,
} from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.HR_MANAGER,
  UserRole.EMPLOYEE,
)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily')
  daily(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: DailyReportQueryDto,
  ) {
    return this.reportsService.getDailyReport(user, query);
  }

  @Get('monthly')
  monthly(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: MonthlyReportQueryDto,
  ) {
    return this.reportsService.getMonthlyReport(user, query);
  }

  @Get('payroll')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  payroll(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: MonthlyReportQueryDto,
  ) {
    return this.reportsService.getPayrollReport(user, query);
  }

  @Get('attendance-export')
  attendanceExport(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: DateRangeReportQueryDto,
  ) {
    return this.reportsService.getAttendanceExport(user, query);
  }

  @Get('raw-punches')
  rawPunches(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: RawPunchesQueryDto,
  ) {
    return this.reportsService.getRawPunches(user, query);
  }

  @Get('employees/:employeeId/history')
  employeeHistory(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: DateRangeReportQueryDto,
  ) {
    return this.reportsService.getEmployeeHistory(user, employeeId, query);
  }

  @Get('late-arrivals')
  lateArrivals(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: LateArrivalsReportQueryDto,
  ) {
    return this.reportsService.getLateArrivals(user, query);
  }

  @Get('overtime')
  overtime(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: OvertimeReportQueryDto,
  ) {
    return this.reportsService.getOvertime(user, query);
  }

  @Get('analytics')
  analytics(
    @CurrentUserDecorator() user: CurrentUser,
    @Query() query: DateRangeReportQueryDto,
  ) {
    return this.reportsService.getAnalytics(user, query);
  }
}
