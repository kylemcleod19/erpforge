import * as fs from "fs";
import * as path from "path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";

const schemaPath = path.join(process.cwd(), "schemas", "spec.schema.json");

let _validate: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  if (_validate) return _validate;
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8")) as object;
  _validate = ajv.compile(schema);
  return _validate;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSpec(spec: unknown): ValidationResult {
  const validate = getValidator();
  const valid = validate(spec) as boolean;
  if (valid) return { valid: true, errors: [] };
  const errors = (validate.errors ?? []).map(
    (e: { instancePath?: string; message?: string }) =>
      `${e.instancePath || "(root)"} ${e.message ?? "unknown error"}`
  );
  return { valid: false, errors };
}

export function loadSchemaText(): string {
  return fs.readFileSync(schemaPath, "utf-8");
}

export function loadExampleSpecText(): string {
  const exPath = path.join(process.cwd(), "schemas", "spec.example.json");
  return fs.readFileSync(exPath, "utf-8");
}
