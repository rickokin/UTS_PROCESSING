/**
 * Stub loader for the behavioral pipeline. No schemas/prompts/rules exist yet;
 * once they do, mirror the shape of src/lib/pipelines/insights/loader.ts.
 */

export async function loadSchemas(): Promise<never> {
  throw new Error("Behavioral pipeline schemas are not defined yet.");
}

export async function loadPrompts(): Promise<never> {
  throw new Error("Behavioral pipeline prompts are not defined yet.");
}
