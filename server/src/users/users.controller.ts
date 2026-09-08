import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUserDecorator } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUser } from '../auth/types/current-user.type';
import { UsersService } from './users.service';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';
import { UpdateEmployeeSalaryDto } from './dto/update-employee-salary.dto';
import { UpdateEmployeeCredentialsDto } from './dto/update-employee-credentials.dto';
import { CreateEmployeeEarningDto } from './dto/create-employee-earning.dto';
import { UpdateEmployeeEarningStatusDto } from './dto/update-employee-earning-status.dto';
import { CreateEmployeeLoanDto } from './dto/create-employee-loan.dto';
import { UpdateEmployeeLoanDto } from './dto/update-employee-loan.dto';

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

  @Get('employee-credentials')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  listEmployeeCredentials(@CurrentUserDecorator() user: CurrentUser) {
    return this.usersService.listEmployeeCredentials(user);
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
      dto.allowance,
    );
  }

  @Patch('employees/:id/credentials')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  updateEmployeeCredentials(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeCredentialsDto,
  ) {
    return this.usersService.updateEmployeeCredentials(user, id, dto);
  }

  @Get('employees/:id/earnings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  listEmployeeEarnings(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('month') month?: string,
  ) {
    return this.usersService.listEmployeeEarnings(user, id, month);
  }

  @Post('employees/:id/earnings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  createEmployeeEarning(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEmployeeEarningDto,
  ) {
    return this.usersService.createEmployeeEarning(user, id, dto);
  }

  @Patch('employees/:id/earnings/:earningId/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  updateEmployeeEarningStatus(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('earningId', ParseUUIDPipe) earningId: string,
    @Body() dto: UpdateEmployeeEarningStatusDto,
  ) {
    return this.usersService.updateEmployeeEarningStatus(user, id, earningId, dto);
  }

  @Delete('employees/:id/earnings/:earningId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  deleteEmployeeEarning(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('earningId', ParseUUIDPipe) earningId: string,
  ) {
    return this.usersService.deleteEmployeeEarning(user, id, earningId);
  }

  @Get('employee-loans')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  listAllEmployeeLoans(@CurrentUserDecorator() user: CurrentUser) {
    return this.usersService.listAllEmployeeLoans(user);
  }

  @Get('employees/:id/loans')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  listEmployeeLoans(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.listEmployeeLoans(user, id);
  }

  @Post('employees/:id/loans')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  createEmployeeLoan(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEmployeeLoanDto,
  ) {
    return this.usersService.createEmployeeLoan(user, id, dto);
  }

  @Patch('employees/:id/loans/:loanId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  updateEmployeeLoan(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('loanId', ParseUUIDPipe) loanId: string,
    @Body() dto: UpdateEmployeeLoanDto,
  ) {
    return this.usersService.updateEmployeeLoan(user, id, loanId, dto);
  }

  @Delete('employees/:id/loans/:loanId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
  deleteEmployeeLoan(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('loanId', ParseUUIDPipe) loanId: string,
  ) {
    return this.usersService.deleteEmployeeLoan(user, id, loanId);
  }
}
