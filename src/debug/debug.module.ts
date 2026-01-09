import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { GhlClientModule } from '../ghl-client/ghl-client.module';

@Module({
  imports: [GhlClientModule],
  controllers: [DebugController],
})
export class DebugModule {}
