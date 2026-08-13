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
import {
  AssignEmployeeShiftDto,
  CreateShiftDto,
  UpdateShiftDto,
} from './dto/shift.dto';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}
  @Get() list(@CurrentUserDecorator() user: CurrentUser) {
    return this.shifts.list(user);
  }
  @Post() create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateShiftDto,
  ) {
    return this.shifts.create(user, dto);
  }
  @Patch(':id') update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.shifts.update(user, id, dto);
  }
  @Delete(':id') remove(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shifts.remove(user, id);
  }
  @Post('employees/:employeeId/assign') assign(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: AssignEmployeeShiftDto,
  ) {
    return this.shifts.assign(user, employeeId, dto);
  }
}
