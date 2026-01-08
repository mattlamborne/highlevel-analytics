import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  APP_URL: Joi.string().uri().required(),
  DATABASE_URL: Joi.string().required(),
  GHL_CLIENT_ID: Joi.string().required(),
  GHL_CLIENT_SECRET: Joi.string().required(),
  GHL_REDIRECT_URI: Joi.string().uri().required(),
  GHL_API_BASE_URL: Joi.string().uri().default('https://services.leadconnectorhq.com'),
  ENCRYPTION_KEY: Joi.string().hex().length(64).required(),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
});
