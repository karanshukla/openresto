import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightOpenAPI, { openAPISidebarGroups } from "starlight-openapi";

export default defineConfig({
  site: "https://docs.openres.to",
  integrations: [
    starlight({
      title: "OpenResto Docs",
      description: "Documentation for self-hosting and integrating OpenResto, the self-hosted restaurant booking system.",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/karanshukla/openresto" }],
      editLink: { baseUrl: "https://github.com/karanshukla/openresto/edit/main/docs-site/" },
      plugins: [
        starlightOpenAPI([
          {
            base: "api/reference",
            label: "API reference",
            schema: "../openresto-cli/openapi/v1.json",
          },
        ]),
      ],
      sidebar: [
        { label: "Self-hosting", items: [{ autogenerate: { directory: "self-hosting" } }] },
        { label: "Guides", items: [{ autogenerate: { directory: "guides" } }] },
        { label: "API", items: [{ slug: "api/authentication" }, ...openAPISidebarGroups] },
      ],
    }),
  ],
});
