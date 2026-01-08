import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'highlevel-analytics',
    };
  }

  @Get('health')
  checkHealth() {
    return {
      status: 'healthy',
      uptime: process.uptime(),
    };
  }
}
