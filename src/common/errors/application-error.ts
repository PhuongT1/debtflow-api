/** Business failures carry a category and message key; transport adapters choose the HTTP status. */
export class ApplicationError extends Error {
  constructor(
    readonly kind: 'invalid' | 'forbidden' | 'not-found',
    readonly key: string,
  ) {
    super(key);
    this.name = 'ApplicationError';
  }
}
