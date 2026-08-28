import { Command } from "commander";
import { clientFor, getGlobalOptions, handle } from "../context.js";
import { printResult } from "../output.js";
import { readJsonInput, omitUndefined } from "../io.js";

interface BrandSetOptions {
  appName?: string;
  primaryColor?: string;
  accentColor?: string;
  faviconIcon?: string;
  websiteUrl?: string;
  phoneNumber?: string;
  emailAddress?: string;
  copyrightText?: string;
  subtitle?: string;
  highlightsHeading?: string;
  highlightsSubheading?: string;
  headerImageFit?: string;
  fromJson?: string;
}

export function registerBrandCommands(program: Command): void {
  const brand = program
    .command("brand")
    .description("Manage global brand settings");

  brand
    .command("get")
    .description("Show the current brand settings (public endpoint)")
    .action(
      handle(async (_options: unknown, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);
        const result = await client.get("/api/brand");
        printResult(result, Boolean(globals.json));
      }),
    );

  brand
    .command("set")
    .description(
      "Update brand settings, via flags or a JSON document (--from-json file, or - for stdin). " +
        "An empty string clears a field; an omitted field leaves it unchanged.",
    )
    .option("--app-name <name>", "App/brand name")
    .option("--primary-color <hex>", "Primary color, e.g. #0a7ea4")
    .option("--accent-color <hex>", "Accent color")
    .option("--favicon-icon <key>", "Lucide icon key")
    .option("--website-url <url>", "Public website URL")
    .option("--phone-number <phone>", "Default contact phone")
    .option("--email-address <email>", "Default contact email")
    .option("--copyright-text <text>", "Footer copyright text")
    .option("--subtitle <text>", "Homepage subtitle")
    .option("--highlights-heading <text>", "Highlights section heading")
    .option("--highlights-subheading <text>", "Highlights section subheading")
    .option("--header-image-fit <fit>", "Cover or Contain")
    .option(
      "--from-json <fileOrDash>",
      "Read the full request body from a file, or - for stdin",
    )
    .action(
      handle(async (options: BrandSetOptions, command: Command) => {
        const { client } = clientFor(command);
        const globals = getGlobalOptions(command);

        const body = options.fromJson
          ? await readJsonInput(options.fromJson)
          : omitUndefined({
              appName: options.appName,
              primaryColor: options.primaryColor,
              accentColor: options.accentColor,
              faviconIcon: options.faviconIcon,
              websiteUrl: options.websiteUrl,
              phoneNumber: options.phoneNumber,
              emailAddress: options.emailAddress,
              copyrightText: options.copyrightText,
              subtitle: options.subtitle,
              highlightsHeading: options.highlightsHeading,
              highlightsSubheading: options.highlightsSubheading,
              headerImageFit: options.headerImageFit,
            });

        if (Object.keys(body as object).length === 0) {
          throw new Error(
            "Nothing to update — pass at least one flag or --from-json.",
          );
        }

        const result = await client.patch("/api/brand", { body });
        printResult(result, Boolean(globals.json));
      }),
    );
}
