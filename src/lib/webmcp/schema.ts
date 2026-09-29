// Minimal JSON Schema validation for tool inputs. Browsers are not required to
// validate WebMCP inputs, so every tool call is checked here and agents get
// precise error messages ("screenshots[0].dataUrl is required").

export interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean'
  description?: string
  enum?: readonly unknown[]
  properties?: Record<string, JsonSchema>
  required?: readonly string[]
  additionalProperties?: boolean | JsonSchema
  items?: JsonSchema
  minItems?: number
  maxItems?: number
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  anyOf?: JsonSchema[]
  default?: unknown
}

export class ToolInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolInputError'
  }
}

function typeOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  return typeof v
}

export function validate(schema: JsonSchema, value: unknown, path = 'input'): void {
  if (schema.anyOf) {
    const errors: string[] = []
    for (const s of schema.anyOf) {
      try {
        validate(s, value, path)
        return
      } catch (e) {
        errors.push((e as Error).message)
      }
    }
    throw new ToolInputError(`${path} did not match any allowed form (${errors.join(' | ')})`)
  }
  const t = typeOf(value)
  if (schema.type) {
    const ok = schema.type === t || (schema.type === 'number' && t === 'integer')
    if (!ok) throw new ToolInputError(`${path} must be ${schema.type}, got ${t}`)
  }
  if (schema.enum && !schema.enum.includes(value)) {
    throw new ToolInputError(`${path} must be one of ${schema.enum.map(v => JSON.stringify(v)).join(', ')}`)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ToolInputError(`${path} must be a finite number`)
    if (schema.minimum !== undefined && value < schema.minimum) throw new ToolInputError(`${path} must be ≥ ${schema.minimum}`)
    if (schema.maximum !== undefined && value > schema.maximum) throw new ToolInputError(`${path} must be ≤ ${schema.maximum}`)
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) throw new ToolInputError(`${path} must have at least ${schema.minLength} characters`)
    if (schema.maxLength !== undefined && value.length > schema.maxLength) throw new ToolInputError(`${path} must have at most ${schema.maxLength} characters`)
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) throw new ToolInputError(`${path} has an invalid format`)
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) throw new ToolInputError(`${path} needs at least ${schema.minItems} items`)
    if (schema.maxItems !== undefined && value.length > schema.maxItems) throw new ToolInputError(`${path} allows at most ${schema.maxItems} items`)
    if (schema.items) value.forEach((v, i) => validate(schema.items!, v, `${path}[${i}]`))
  }
  if (t === 'object' && (schema.properties || schema.required || schema.additionalProperties !== undefined)) {
    const obj = value as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (obj[key] === undefined) throw new ToolInputError(`${path}.${key} is required`)
    }
    for (const [key, v] of Object.entries(obj)) {
      if (v === undefined) continue
      const prop = schema.properties?.[key]
      if (prop) validate(prop, v, `${path}.${key}`)
      else if (schema.additionalProperties === false) {
        const known = Object.keys(schema.properties ?? {})
        throw new ToolInputError(`${path}.${key} is not a known property${known.length ? ` (known: ${known.join(', ')})` : ''}`)
      } else if (typeof schema.additionalProperties === 'object') validate(schema.additionalProperties, v, `${path}.${key}`)
    }
  }
}

// ---------------------------------------------------------------- schema helpers

export const str = (description?: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({ type: 'string', description, ...extra })
export const num = (description?: string, minimum?: number, maximum?: number): JsonSchema => ({ type: 'number', description, minimum, maximum })
export const int = (description?: string, minimum?: number, maximum?: number): JsonSchema => ({ type: 'integer', description, minimum, maximum })
export const bool = (description?: string): JsonSchema => ({ type: 'boolean', description })
export const enm = (values: readonly string[], description?: string): JsonSchema => ({ type: 'string', enum: values, description })
export const hex = (description = 'Hex color #rrggbb'): JsonSchema => ({ type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description })
export const arr = (items: JsonSchema, description?: string, minItems?: number, maxItems?: number): JsonSchema => ({ type: 'array', items, description, minItems, maxItems })
export const obj = (properties: Record<string, JsonSchema>, required: string[] = [], description?: string): JsonSchema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
  description,
})
