import { defineConfig } from "astro/config";
import { SITE_URL, BASE_PATH } from "./src/config/site.js";

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: "never",
});
