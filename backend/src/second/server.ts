import { openDb } from "./db";
import { createApp } from "./http/app";

const db = openDb(process.env.DB_FILE ?? "clinic.db");
const app = createApp({ db });
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`second: queue API on :${port}`));