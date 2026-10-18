import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (!origin) {
    next();
    return;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    res.status(403).json({ error: "Cross-site requests are not allowed." });
    return;
  }
  const originHost = originUrl.host.toLowerCase();
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHosts = [req.get("host"), forwardedHost].filter(
    (host): host is string => Boolean(host),
  );
  const sameOrigin = requestHosts.some((host) => {
    try {
      return new URL(`${originUrl.protocol}//${host}`).host.toLowerCase() === originHost;
    } catch {
      return false;
    }
  });

  if (!sameOrigin) {
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    const hasPasscodeCookie = /(?:^|;\s*)life_tracker_session=/.test(req.get("cookie") ?? "");
    if (isMutation && hasPasscodeCookie) {
      res.status(403).json({ error: "Cross-site requests are not allowed." });
      return;
    }
    next();
    return;
  }

  cors({ origin: true, credentials: true })(req, res, next);
});
app.use(express.json({ limit: "16mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
