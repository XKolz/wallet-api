import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  PAYSTACK_SECRET_KEY: Joi.string().required(),
  PAYSTACK_BASE_URL: Joi.string().uri().default('https://api.paystack.co'),
  PAYSTACK_CALLBACK_URL: Joi.string().uri().optional(),
  ADMIN_PHONE: Joi.string().required(),
  ADMIN_PASSWORD: Joi.string().required(),
  SAMPLE_USER_PHONE: Joi.string().required(),
  SAMPLE_USER_PASSWORD: Joi.string().required()
});
