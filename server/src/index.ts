import "dotenv/config";
import express from "express";
import compression from "compression";
import "express-async-errors";
import cors from "cors";
import { apiRouter } from "./routes/api.js";
import { prisma } from "./prisma.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(",") ?? ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));

app.use("/api", apiRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    const message = err instanceof Error ? err.message : "Server error";
    if (!res.headersSent) {
      const code =
        message.includes("Prisma") || message.includes("database")
          ? 503
          : 500;
      res.status(code).json({
        error: code === 503 ? "Database unavailable" : "Server error",
        detail: message,
      });
    }
  }
);

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log("✓ Database connected");
  } catch (e) {
    console.error("\n❌ Could not connect to PostgreSQL (check server/.env DATABASE_URL).\n");
    console.error("  1) Supabase: open the project dashboard — if the DB is paused, click Resume.");
    console.error("  2) Prefer the Session pooler URL (port 6543) from Connect → not only db.*:5432.");
    console.error("  3) Append sslmode=require if your provider needs it.\n");
    if (e instanceof Error) console.error(e.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`API http://localhost:${PORT}`);
  });
}

void bootstrap();
