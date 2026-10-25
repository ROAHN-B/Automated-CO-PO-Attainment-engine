/** Error thrown by the in-memory mock stores, shaped like the contract's ApiError. */
export class MockError extends Error {
  constructor(readonly status: number, readonly errorCode: string, message: string) { super(message); }
}
