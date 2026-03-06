/**
 * Extract only known (literal) string keys, excluding index signatures.
 * Uses mapped type `as` clause which iterates over each property declaration
 * individually — even when an index signature is present.
 */
type KnownStringKeys<T> = keyof {
  [K in keyof T as K extends string ? (string extends K ? never : K) : never]: never
}

/**
 * Recursively flattens a nested interface into a union of dot-separated key paths.
 * - Arrays, Dates, and Functions are treated as leaf values (not recursed into).
 * - Optional properties (`field?: Type`) are unwrapped via `NonNullable`.
 * - Index signatures (`[k: string]: unknown`) are excluded.
 * - Recursion depth is bounded to prevent infinite types.
 *
 * @example
 * interface Foo { bar: number }
 * interface A { foo: Foo; name: string }
 *
 * type Keys = FlatKeys<A>
 * // "foo.bar" | "name"
 *
 * const arr: FlatKeys<A>[] = ['foo.bar', 'name'] // type-checked
 */
export type FlatKeys<
  T,
  MaxDepth extends number = 10,
  Prefix extends string = '',
  D extends unknown[] = [],
> = D['length'] extends MaxDepth
  ? never
  : {
      [K in KnownStringKeys<T> & keyof T & string]: NonNullable<T[K]> extends readonly any[] | Date | Function
        ? `${Prefix}${K}`
        : NonNullable<T[K]> extends object
          ? FlatKeys<NonNullable<T[K]>, MaxDepth, `${Prefix}${K}.`, [...D, unknown]>
          : `${Prefix}${K}`
    }[KnownStringKeys<T> & keyof T & string]
