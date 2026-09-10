import pino from "pino";
import { config } from "../config/config";

export const logger = pino({
  redact: {
    paths: [
      "req.headers.authorization", "req.headers.cookie", "headers.authorization", "headers.cookie",
      "token", "accessToken", "refreshToken", "idToken", "secret", "privateKey",
    ],
    censor: "[REDACTED]",
  },
  ...(config.env === "production" ? {} : { transport: { target: "pino-pretty" } }),
});
