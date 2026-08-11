import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { UsersService } from './users.service';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';
import { UpdateEmployeeSalaryDto } from './dto/update-employee-salary.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.HR_MANAGER,
  UserRole.EMPLOYEE,
)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('employees')
  listEmployees(@CurrentUserDecorator() user: CurrentUser) {
    return this.usersService.listEmployees(user);
  }

  @Patch('employees/:id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  updateEmployeeStatus(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeStatusDto,
  ) {
    return this.usersService.updateEmployeeStatus(user, id, dto.isActive);
  }

  @Patch('employees/:id/salary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  updateEmployeeSalary(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeSalaryDto,
  ) {
    return this.usersService.updateEmployeeSalary(
      user,
      id,
      dto.monthlySalary,
    );
  }
}
