import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

// Load .env in local dev. In production (Railway) DATABASE_URL is already
// injected as a real environment variable, so this is a safe no-op.
dotenv.config();

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
