import type { APIRoute } from "astro";
import { site } from "../data/site";

const paths = ["/", "/support"];

export const GET: APIRoute = () => {
  const today = new Date().toISOString().slice(0, 10);
  const urls = paths
    .map(
      (path) =>
        `  <url><loc>https://${site.domain}${path}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>${path === "/" ? "1.0" : "0.6"}</priority></url>`,
    )
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
};
