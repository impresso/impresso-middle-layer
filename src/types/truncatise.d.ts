declare module 'truncatise' {
  interface TruncatiseOptions {
    TruncateLength?: number
    TruncateBy?: string // Allow any string since the code is using it as a string
    Strict?: boolean
    StripHTML?: boolean
    Suffix?: string
    maxLength?: number
  }

  /**
   * Truncates text based on provided options
   */
  function truncatise(text: string, options: TruncatiseOptions): string
  export default truncatise
}
