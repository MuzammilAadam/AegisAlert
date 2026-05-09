import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./services/database.js";

const port = process.env.PORT || 5000;

await connectDatabase();

const server = app.listen(port, () => {
  console.log(`Backend API running on http://localhost:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use. Stop the process using it or set a different PORT in .env.`
    );
    console.error(`Windows check: netstat -ano | findstr :${port}`);
    process.exit(1);
  }

  throw error;
});
