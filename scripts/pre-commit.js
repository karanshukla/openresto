const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Get staged files
let stagedFiles = [];
try {
  stagedFiles = execSync("git diff --cached --name-only", { encoding: "utf8" })
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f && fs.existsSync(f));
} catch (e) {
  console.error("Failed to get staged files:", e.message);
  process.exit(1);
}

if (stagedFiles.length === 0) {
  console.log("No staged files to process.");
  process.exit(0);
}

console.log(`Processing ${stagedFiles.length} staged files...`);

// 1. Fix line endings (convert to LF)
let modified = false;
stagedFiles.forEach((file) => {
  if (fs.lstatSync(file).isFile()) {
    try {
      const buffer = fs.readFileSync(file);
      const content = buffer.toString("utf8");
      // Simple check for CRLF
      if (content.includes("\r\n")) {
        const lfContent = content.replace(/\r\n/g, "\n");
        fs.writeFileSync(file, lfContent, "utf8");
        console.log(`Fixed line endings (LF): ${file}`);
        modified = true;
      }
    } catch (e) {
      console.warn(`Could not process line endings for ${file}: ${e.message}`);
    }
  }
});

// 2. Prettier
const prettierFiles = stagedFiles.filter((f) =>
  /\.(js|jsx|ts|tsx|json|css|md|yml|yaml)$/.test(f),
);
if (prettierFiles.length > 0) {
  console.log("Running Prettier...");
  try {
    execSync(
      `npx prettier --write ${prettierFiles.map((f) => `"${f}"`).join(" ")}`,
      { stdio: "inherit" },
    );
    modified = true;
  } catch (e) {
    console.error("Prettier failed, but continuing...");
  }
}

// 3. Frontend Linter (ESLint via Expo)
const frontendFiles = stagedFiles.filter(
  (f) => f.startsWith("openresto-frontend/") && /\.(js|jsx|ts|tsx)$/.test(f),
);
if (frontendFiles.length > 0) {
  console.log("Running Frontend Linter (Full Project)...");
  try {
    execSync(`npx expo lint --fix`, {
      cwd: "openresto-frontend",
      stdio: "inherit",
    });
    modified = true;
  } catch (e) {
    console.error("Frontend linter found errors.");
    process.exit(1);
  }
}

// 4. Backend Linter (dotnet format)
const backendFiles = stagedFiles.filter(
  (f) => f.startsWith("OpenRestoApi/") && f.endsWith(".cs"),
);
if (backendFiles.length > 0) {
  console.log("Running Backend Linter...");
  try {
    execSync(
      `dotnet format OpenRestoApi/OpenRestoApi.csproj --include ${backendFiles.map((f) => `"${f}"`).join(" ")}`,
      { stdio: "inherit" },
    );
    modified = true;
  } catch (e) {
    console.error("Backend linter failed.");
    process.exit(1);
  }
}

// 5. Re-add modified files
if (modified) {
  console.log("Re-staging modified files...");
  execSync(`git add ${stagedFiles.map((f) => `"${f}"`).join(" ")}`);
}

console.log("Pre-commit checks passed!");
