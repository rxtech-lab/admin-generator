const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Version comes from the release tag passed on the command line, e.g. "v1.2.3".
let version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/publish.js <version>");
  process.exit(1);
}
// Strip any leading "v" so package.json holds a clean semver.
version = version.replace(/^v/, "");

// The publishable package lives in the monorepo, not the private root.
const pkgDir = path.join(__dirname, "..", "packages", "admin-next");
const pkgPath = path.join(pkgDir, "package.json");

// Set the package version from the release tag.
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.version = version;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`Set ${pkg.name} version to ${version}`);

// Authenticate to npm using the token from the environment.
execSync(`npm config set //registry.npmjs.org/:_authToken ${process.env.NPM_TOKEN}`, {
  stdio: "inherit",
});

// Publish from the package directory with provenance.
execSync("npm publish --access public --provenance", {
  cwd: pkgDir,
  stdio: "inherit",
});
