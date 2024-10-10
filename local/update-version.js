import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// __dirname is not available in ES modules, so we recreate it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to style.css and package.json
const styleCssPath = path.join(
  __dirname,
  "../wp-content/themes/whalepress/style.css"
);
const packageJsonPath = path.join(__dirname, "../package.json");

try {
  // Read package.json to get the latest version
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  const newVersion = packageJson.version;

  // Read the style.css file
  let styleCssContent = await fs.readFile(styleCssPath, "utf8");

  // Find and replace the version in style.css
  const versionRegex = /Version:\s*(\d+\.\d+\.\d+)/;
  styleCssContent = styleCssContent.replace(
    versionRegex,
    `Version: ${newVersion}`
  );

  // Write the updated content back to style.css
  await fs.writeFile(styleCssPath, styleCssContent);

  console.log(`Updated style.css to version ${newVersion}`);
} catch (error) {
  console.error("Error updating version:", error);
}
