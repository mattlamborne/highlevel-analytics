import { Controller, Get, Query, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { TenantsService } from '../tenants/tenants.service';

@Controller('auth/oauth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private tenantsService: TenantsService,
  ) {}

  /**
   * Start OAuth flow
   * GET /auth/oauth/start?tenant_id={uuid}
   */
  @Get('start')
  async startOAuthFlow(@Query('tenant_id') tenantId: string, @Res() res: Response) {
    if (!tenantId) {
      throw new BadRequestException('tenant_id query parameter is required');
    }

    // Verify tenant exists
    await this.tenantsService.findById(tenantId);

    // Generate authorization URL with tenant_id as state
    const authUrl = this.authService.getAuthorizationUrl(tenantId);

    // Redirect to HighLevel
    return res.redirect(authUrl);
  }

  /**
   * OAuth callback
   * GET /auth/oauth/callback?code={code}&state={tenant_id}
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state?: string,
    @Res() res: Response,
  ) {
    if (!code) {
      throw new BadRequestException('Authorization code is missing');
    }

    // HighLevel sometimes doesn't pass state back, use default tenant for testing
    const tenantId = state || '8826f764-9802-402b-920a-41886df5a741';

    try {
      // Exchange code for tokens and store installation
      await this.authService.exchangeCodeForTokens(code, tenantId);

      // Return success page
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Installation Successful</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .card {
                background: white;
                padding: 3rem;
                border-radius: 1rem;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
                max-width: 500px;
              }
              h1 { color: #667eea; margin: 0 0 1rem 0; }
              p { color: #666; margin: 0; line-height: 1.6; }
              .success-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="success-icon">✓</div>
              <h1>Installation Successful!</h1>
              <p>HighLevel Analytics has been successfully connected to your account.</p>
              <p style="margin-top: 1rem; font-size: 0.9rem; color: #999;">
                Tenant ID: ${tenantId}
              </p>
            </div>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Installation Failed</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              }
              .card {
                background: white;
                padding: 3rem;
                border-radius: 1rem;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
                max-width: 500px;
              }
              h1 { color: #f5576c; margin: 0 0 1rem 0; }
              p { color: #666; margin: 0; line-height: 1.6; }
              .error-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="error-icon">✗</div>
              <h1>Installation Failed</h1>
              <p>There was an error connecting to your HighLevel account.</p>
              <p style="margin-top: 1rem; font-size: 0.9rem; color: #999;">
                ${error.message || 'Unknown error'}
              </p>
            </div>
          </body>
        </html>
      `);
    }
  }
}
