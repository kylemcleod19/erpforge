/**
 * CI script: validates spec.example.json against spec.schema.json.
 * Exits with code 1 if validation fails so GitHub Actions marks the step as failed.
 *
 * Usage: npx tsx scripts/validate-schema.ts
 */
import * as fs from "fs";
import * as path from "path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = process.cwd();
const schemaPath = path.join(root, "schemas", "spec.schema.json");
const examplePath = path.join(root, "schemas", "spec.example.json");

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8")) as object;
const example = JSON.parse(fs.readFileSync(examplePath, "utf-8")) as unknown;

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const valid = validate(example);

if (valid) {
  console.log("✓ spec.example.json is valid against spec.schema.json");
  process.exit(0);
} else {
  console.error("✗ spec.example.json validation failed:");
  for (const err of validate.errors ?? []) {
    console.error(`  ${err.instancePath || "(root)"} ${err.message ?? ""}`);
  }
  process.exit(1);
}
