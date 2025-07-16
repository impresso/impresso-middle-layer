import { get } from 'lodash'
import { BadRequest } from '@feathersjs/errors'
import { validated, formatValidationErrors } from '../util/json'
import { HookContext } from '@feathersjs/feathers'

/**
 * Validates the data at the specified object path against the provided schema URI.
 *
 * @param schemaUri - The URI of the schema to validate against, relative to src/ path.
 * @param objectPath - The path to the data within the context to validate. Defaults to 'data'.
 * @returns A function that takes a HookContext and returns the HookContext if validation passes.
 * @throws {BadRequest} If validation fails, throws a BadRequest error with the validation errors.
 *
 * @example
 * ```typescript
 * const schemaUri = 'services/me/schema/post/payload.json';
 * const objectPath = 'data';
 * const hook = validateWithSchema(schemaUri, objectPath);
 *
 * // In a hook context
 * const context = { data: { some data  } };
 * try {
 *   hook(context);
 *   console.log('Validation passed');
 * } catch (error) {
 *   console.error('Validation failed', error);
 * }
 * ```
 */
const validateWithSchema =
  (schemaUri: string, objectPath: string = 'data') =>
  (context: HookContext): HookContext => {
    const data = get(context, objectPath)
    if (!data) {
      console.error(`Validation failed: objectPath "${objectPath}" is missing in context`)
      throw new BadRequest('Validation failed', [])
    }
    try {
      validated(data, schemaUri)
      return context
    } catch (e: any) {
      if (!e.message) {
        console.error(e)
        throw new BadRequest('Validation failed', e)
      }
      console.error(e)
      console.error(JSON.stringify(data))
      throw new BadRequest(e.message, formatValidationErrors(e.errors))
    }
  }

export { validateWithSchema }
