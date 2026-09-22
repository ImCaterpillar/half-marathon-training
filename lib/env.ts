export function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getAppTimezone() {
  return process.env.APP_TIMEZONE || "Asia/Shanghai";
}
