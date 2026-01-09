import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { CryptoModule } from './crypto/crypto.module';
import { TenantsModule } from './tenants/tenants.module';
import { AuthModule } from './auth/auth.module';
import { GhlClientModule } from './ghl-client/ghl-client.module';
import { JobsModule } from './jobs/jobs.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { MetricsModule } from './metrics/metrics.module';
import { DebugModule } from './debug/debug.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    CryptoModule,
    JobsModule,
    TenantsModule,
    AuthModule,
    GhlClientModule,
    WebhooksModule,
    MetricsModule,
    DebugModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
