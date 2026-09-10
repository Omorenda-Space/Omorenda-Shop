import express from "express";
import cors from "cors";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import { webhookRoutes } from "./routes/webhookRoutes";
import { apiRoutes } from "./routes/apiRoutes";
import { authRoutes } from "./routes/authRoutes";
import { logger } from "./utils/logger";
import { corsOrigin, requireTrustedOrigin } from "./auth/requestSecurity";

export const app = express();

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

// Webhooks must come before express.json()
app.use("/webhooks", webhookRoutes);

app.use(express.json({ limit: "64kb" }));
app.use("/api", requireTrustedOrigin);

app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);

app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  logger.error(
    {
      err: error instanceof Error ? error.message : String(error),
      method: req.method,
      path: req.originalUrl,
    },
    "[HTTP] unhandled request error",
  );

  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong. Please try again.",
  });
});

