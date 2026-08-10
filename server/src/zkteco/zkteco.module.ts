import { Module } from '@nestjs/common';

import { ZKTecoService } from './zkteco.service';

@Module({
  providers: [ZKTecoService],
  exports: [ZKTecoService],
})
export class ZKTecoModule {}
