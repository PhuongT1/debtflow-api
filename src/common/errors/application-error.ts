/** Business failures carry a category and message key; transport adapters choose the HTTP status. */
export class ApplicationError extends Error {
  constructor(
    readonly kind: 'invalid' | 'conflict' | 'unauthorized' | 'forbidden' | 'not-found',
    readonly key: string,
    readonly params?: Record<string, string | number>,
  ) {
    super(key);
    this.name = 'ApplicationError';
  }
}
