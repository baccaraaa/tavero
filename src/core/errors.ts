export class TaveroError extends Error {
  constructor(public code: string, message: string, public exitCode = 1) {
    super(message);
    this.name = 'TaveroError';
  }
}
