import { defineConfig } from "astro/config";
import { SITE_URL } from "./src/config/site.js";

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "never",
});
