import { Controller, Get, Param, Logger } from '@nestjs/common';
import { GhlClientService } from '../ghl-client/ghl-client.service';

@Controller('debug')
export class DebugController {
  private readonly logger = new Logger(DebugController.name);

  constructor(private readonly ghlClient: GhlClientService) {}

  /**
   * Test fetching an appointment from HighLevel API
   * GET /debug/appointment/:locationId/:appointmentId
   */
  @Get('appointment/:locationId/:appointmentId')
  async testGetAppointment(
    @Param('locationId') locationId: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    this.logger.log(`Testing appointment fetch: ${appointmentId}`);

    try {
      const appointment = await this.ghlClient.getAppointment(locationId, appointmentId);

      if (!appointment) {
        return {
          success: false,
          message: 'Appointment returned null',
          appointmentId,
          locationId,
        };
      }

      return {
        success: true,
        appointment,
      };
    } catch (error: any) {
      this.logger.error('Error fetching appointment:', error);

      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        appointmentId,
        locationId,
      };
    }
  }
}
