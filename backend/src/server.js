import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./services/database.js";

const port = process.env.PORT || 5000;

await connectDatabase();

app.listen(port, () => {
  console.log(`Backend API running on http://localhost:${port}`);
});
