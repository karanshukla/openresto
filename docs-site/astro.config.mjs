import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightOpenAPI, { openAPISidebarGroups } from "starlight-openapi";

export default defineConfig({
  site: "https://docs.openres.to",
  integrations: [
    starlight({
      title: "OpenResto Docs",
      description: "Documentation for self-hosting and integrating OpenResto, the self-hosted restaurant booking system.",
      favicon: "/favicon.svg",
      customCss: ["@fontsource-variable/inter", "./src/styles/theme.css"],
      components: {
        SiteTitle: "./src/components/SiteTitle.astro",
        SocialIcons: "./src/components/SocialIcons.astro",
        Footer: "./src/components/Footer.astro",
      },
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/karanshukla/openresto" },
        { icon: "instagram", label: "Instagram", href: "https://www.instagram.com/openresto.app/" },
        { icon: "threads", label: "Threads", href: "https://www.threads.com/@openresto.app" },
      ],
      editLink: { baseUrl: "https://github.com/karanshukla/openresto/edit/main/docs-site/" },
      // One dark theme in both modes: commands sit on the landing page's ink terminal.
      expressiveCode: {
        themes: ["github-dark-default"],
        useStarlightUiThemeColors: false,
        styleOverrides: {
          borderRadius: "14px",
          borderColor: "transparent",
          codeBackground: "#16130f",
          codeForeground: "#f6f2ec",
          frames: {
            editorBackground: "#16130f",
            terminalBackground: "#16130f",
            terminalTitlebarBackground: "#16130f",
            terminalTitlebarBorderBottomColor: "rgba(246, 242, 236, 0.08)",
            terminalTitlebarDotsForeground: "rgba(246, 242, 236, 0.22)",
            editorTabBarBackground: "#16130f",
            editorActiveTabBackground: "#211d17",
            editorTabBarBorderBottomColor: "rgba(246, 242, 236, 0.08)",
            frameBoxShadowCssValue: "none",
            inlineButtonBorder: "rgba(246, 242, 236, 0.3)",
            inlineButtonForeground: "#f6f2ec",
          },
        },
      },
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
