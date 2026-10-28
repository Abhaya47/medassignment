import path from "node:path";
import { loadCatalogFromFile } from "./catalog/load-catalog";
import { createApp } from "./http/app";

const catalog = loadCatalogFromFile(
  path.resolve(__dirname, "../../data/lab-catalog.json")
);
catalog.warnings.forEach((w) => console.warn("[catalog]", w));

const port = Number(process.env.PORT) || 4000;
createApp(catalog).listen(port, () => console.log(`API on :${port}`));