import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const secretDirectory = new URL("../.local/secrets/", import.meta.url);
const secretFile = new URL("db_password", secretDirectory);
await mkdir(secretDirectory, { recursive: true, mode: 0o700 });

try {
  await writeFile(secretFile, randomBytes(32).toString("hex"), {
    flag: "wx",
    mode: 0o644,
  });
  console.log("Created a local-only database secret. Its value is not logged.");
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
    throw error;
  }
  const existing = await readFile(secretFile, "utf8");
  if (!/^[a-f0-9]{64}\n?$/.test(existing)) {
    throw new Error(
      `Invalid existing local secret at ${fileURLToPath(secretFile)}; refusing to overwrite it.`,
    );
  }
  console.log("Existing local database secret retained unchanged.");
}
