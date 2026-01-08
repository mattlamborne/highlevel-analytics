export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  database: {
    url: process.env.DATABASE_URL,
  },
  ghl: {
    clientId: process.env.GHL_CLIENT_ID,
    clientSecret: process.env.GHL_CLIENT_SECRET,
    redirectUri: process.env.GHL_REDIRECT_URI,
    apiBaseUrl: process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com',
    appVersionId: process.env.GHL_APP_VERSION_ID,
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
});
