export class ScrapeError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean,
    public status = 422,
  ) {
    super(message);
  }
}
