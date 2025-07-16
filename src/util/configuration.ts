import { Application, ApplicationHookContext, NextFunction } from '@feathersjs/feathers'
import { Schema, Validator } from '@feathersjs/schema'
import config from 'config'

/**
 * Recursively traverses an object (including arrays and nested objects) and replaces
 * any string values matching the pattern `${VARIABLE_NAME}` with the corresponding
 * environment variable value.
 *
 * @param obj - The object to process (can be an object, array, or primitive value)
 * @param envVars - Optional environment variables object (defaults to process.env)
 * @returns A new object with environment variable substitutions applied
 *
 * @example
 * ```typescript
 * const config = {
 *   database: {
 *     host: '${DB_HOST}',
 *     port: '${DB_PORT}',
 *     credentials: ['${DB_USER}', '${DB_PASS}']
 *   },
 *   features: ['${FEATURE_A}', 'static-feature']
 * }
 *
 * // With environment variables: DB_HOST=localhost, DB_PORT=5432, DB_USER=admin, DB_PASS=secret, FEATURE_A=advanced
 * const result = replaceEnvVariables(config)
 * // Returns:
 * // {
 * //   database: {
 * //     host: 'localhost',
 * //     port: '5432',
 * //     credentials: ['admin', 'secret']
 * //   },
 * //   features: ['advanced', 'static-feature']
 * // }
 * ```
 */
export function replaceEnvVariables<T>(obj: T, envVars: Record<string, string | undefined> = process.env): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return replaceEnvVariable(obj, envVars) as T
    }
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => replaceEnvVariables(item, envVars)) as T
  }

  // Handle objects
  const result = {} as T
  for (const [key, value] of Object.entries(obj)) {
    ;(result as any)[key] = replaceEnvVariables(value, envVars)
  }

  return result
}

/**
 * Replaces a single string value if it matches the `${VARIABLE_NAME}` pattern.
 *
 * @param value - The string value to check and potentially replace
 * @param envVars - Environment variables object
 * @returns The original value or the environment variable value if pattern matches
 */
function replaceEnvVariable(value: string, envVars: Record<string, string | undefined>): string {
  // Match the pattern ${VARIABLE_NAME}
  const envVarPattern = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/
  const match = value.match(envVarPattern)

  if (match) {
    const varName = match[1]
    const envValue = envVars[varName]

    if (envValue !== undefined) {
      return envValue
    }

    // If the variable is not found, raise an error
    throw new Error(`Environment variable ${varName} is not defined`)

    // // If environment variable is not found, return the original value
    // // This allows for graceful fallback behavior
    // return value
  }

  return value
}

/**
 * Replaces environment variables in a configuration object and validates
 * that all required environment variables are present.
 *
 * @param obj - The object to process
 * @param requiredVars - Array of environment variable names that must be present
 * @param envVars - Optional environment variables object (defaults to process.env)
 * @returns A new object with environment variable substitutions applied
 * @throws Error if any required environment variables are missing
 *
 * @example
 * ```typescript
 * const config = {
 *   database: {
 *     host: '${DB_HOST}',
 *     port: '${DB_PORT}'
 *   }
 * }
 *
 * const result = replaceEnvVariablesStrict(config, ['DB_HOST', 'DB_PORT'])
 * // Throws an error if DB_HOST or DB_PORT are not set in environment
 * ```
 */
export function replaceEnvVariablesStrict<T>(
  obj: T,
  requiredVars: string[],
  envVars: Record<string, string | undefined> = process.env
): T {
  // Check that all required environment variables are present
  const missingVars = requiredVars.filter(varName => envVars[varName] === undefined)

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
  }

  return replaceEnvVariables(obj, envVars)
}

/**
 * A drop-in replacement for `@feathersjs/configuration` that loads configuration
 * from a JSON file and applies environment variable substitutions.
 *
 * https://github.com/feathersjs/feathers/blob/dove/packages/configuration/src/index.ts
 */
export function feathersConfigurationLoader(schema?: Schema<any> | Validator) {
  const validator = typeof schema === 'function' ? schema : schema?.validate.bind(schema)

  return (app?: Application) => {
    if (!app) {
      return replaceEnvVariables(config)
    }

    const configuration: { [key: string]: unknown } = replaceEnvVariables({ ...config })

    Object.keys(configuration).forEach(name => {
      const value = configuration[name]
      app.set(name, value)
    })

    if (validator) {
      app.hooks({
        setup: [
          async (_context: ApplicationHookContext, next: NextFunction) => {
            await validator(configuration)
            await next()
          },
        ],
      })
    }

    return config
  }
}
