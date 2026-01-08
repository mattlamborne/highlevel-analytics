import { Global, Module } from '@nestjs/common';
import { GhlClientService } from './ghl-client.service';

@Global()
@Module({
  providers: [GhlClientService],
  exports: [GhlClientService],
})
export class GhlClientModule {}
