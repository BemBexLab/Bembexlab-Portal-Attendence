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
import { CreateDeviceDto } from './dto/create-device.dto';
import { TestDeviceDto } from './dto/test-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DevicesService } from './devices.service';

@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  list(@CurrentUserDecorator() user: CurrentUser) {
    return this.devicesService.listDevices(user);
  }

  @Post()
  add(@CurrentUserDecorator() user: CurrentUser, @Body() dto: CreateDeviceDto) {
    return this.devicesService.addDevice(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.devicesService.updateDevice(user, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.devicesService.removeDevice(user, id);
  }

  @Post('test')
  test(@Body() dto: TestDeviceDto) {
    return this.devicesService.testConnection(dto);
  }

  @Post(':id/test')
  testSaved(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.devicesService.testSavedDeviceConnection(user, id);
  }

  @Get(':id/info')
  info(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.devicesService.fetchDeviceInfo(user, id);
  }

  @Post(':id/sync-attendance')
  syncAttendance(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.devicesService.syncAttendanceLogs(user, id);
  }
}
