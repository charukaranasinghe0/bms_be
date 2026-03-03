import dotenv from "dotenv";

dotenv.config();

interface Env {
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ACCESS_TOKEN_TTL_DAYS: number;
  REFRESH_TOKEN_TTL_DAYS: number;
  REFRESH_COOKIE_NAME: string;
  NODE_ENV: string;
}

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const getRequiredNumberEnv = (key: string): number => {
  const raw = getRequiredEnv(key);
  const num = Number(raw);
  if (Number.isNaN(num) || num <= 0) {
    throw new Error(`Environment variable ${key} must be a positive number, got "${raw}"`);
  }
  return num;
};

const portFromEnv = process.env.PORT ? Number(process.env.PORT) : 4000;

if (Number.isNaN(portFromEnv)) {
  throw new Error("Environment variable PORT must be a valid number");
}

export const env: Env = {
  PORT: portFromEnv,
  DATABASE_URL: getRequiredEnv("DATABASE_URL"),
  JWT_ACCESS_SECRET: getRequiredEnv("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: getRequiredEnv("JWT_REFRESH_SECRET"),
  ACCESS_TOKEN_TTL_DAYS: getRequiredNumberEnv("ACCESS_TOKEN_TTL_DAYS"),
  REFRESH_TOKEN_TTL_DAYS: getRequiredNumberEnv("REFRESH_TOKEN_TTL_DAYS"),
  REFRESH_COOKIE_NAME: getRequiredEnv("REFRESH_COOKIE_NAME"),
  NODE_ENV: process.env.NODE_ENV || "development",
};

