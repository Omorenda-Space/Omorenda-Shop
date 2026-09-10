import { app } from "./app";
import { config, validateConfig } from "./config/config";
import { logger } from "./utils/logger";

validateConfig();

app.listen(config.port, () => {
  logger.info(`store-min-be listening on port ${config.port}`);
});

