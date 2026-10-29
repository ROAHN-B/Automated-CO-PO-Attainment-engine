/** Error thrown by the in-memory mock stores, shaped like the contract's ApiError. */
export class MockError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string,
    /** Per-field messages, keyed by request field path (API_CONTRACT §2.2). */
    readonly fieldErrors?: Record<string, string>,
  ) { super(message); }
}
