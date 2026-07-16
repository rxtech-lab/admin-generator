const { execSync, spawnSync } = require("child_process");
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

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid release version: ${version}`);
  process.exit(1);
}

// Public packages share the repository's semantic-release version.
const packageDirectories = ["admin-next", "authjs-rxlab"];

function isPublished(name, packageVersion) {
  const result = spawnSync(
    "npm",
    ["view", `${name}@${packageVersion}`, "version", "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) return false;

  try {
    return JSON.parse(result.stdout) === packageVersion;
  } catch {
    return false;
  }
}

for (const directory of packageDirectories) {
  const pkgDir = path.join(__dirname, "..", "packages", directory);
  const pkgPath = path.join(pkgDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  pkg.version = version;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`Set ${pkg.name} version to ${version}`);

  // A release rerun may follow a partial multi-package publish. Skip versions
  // already present so the remaining package can finish publishing.
  if (isPublished(pkg.name, version)) {
    console.log(`${pkg.name}@${version} is already published; skipping`);
    continue;
  }

  // In GitHub Actions, npm authenticates via this package's trusted publisher.
  execSync("npm publish --access public", {
    cwd: pkgDir,
    stdio: "inherit",
  });
}
