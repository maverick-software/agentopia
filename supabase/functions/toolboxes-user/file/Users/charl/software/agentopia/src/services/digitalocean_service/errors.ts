/**
 * Base error class for errors originating from the DigitalOceanService.
 */ export class DigitalOceanServiceError extends Error {
  originalError;
  constructor(message, originalError){
    super(message);
    this.name = this.constructor.name;
    this.originalError = originalError;
    // Ensuring the prototype chain is correct for custom errors
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
/**
 * Represents an error reported by the DigitalOcean API.
 */ export class DigitalOceanApiError extends DigitalOceanServiceError {
  statusCode;
  apiErrorCode;
  constructor(message, statusCode, apiErrorCode, originalError){
    super(message, originalError);
    this.statusCode = statusCode;
    this.apiErrorCode = apiErrorCode;
  }
}
/**
 * Error for authentication failures with the DigitalOcean API (e.g., invalid token).
 */ export class DigitalOceanAuthenticationError extends DigitalOceanApiError {
  constructor(message = "DigitalOcean API authentication failed.", originalError){
    // Typically a 401 status code
    super(message, 401, undefined, originalError);
  }
}
/**
 * Error when a requested DigitalOcean resource is not found.
 */ export class DigitalOceanResourceNotFoundError extends DigitalOceanApiError {
  constructor(message = "DigitalOcean resource not found.", originalError){
    // Typically a 404 status code
    super(message, 404, undefined, originalError);
  }
}
/**
 * Error for API rate limiting by DigitalOcean.
 */ export class DigitalOceanRateLimitError extends DigitalOceanApiError {
  retryAfter;
  constructor(message = "DigitalOcean API rate limit exceeded.", retryAfter, originalError){
    // Typically a 429 status code
    super(message, 429, undefined, originalError);
    this.retryAfter = retryAfter;
  }
}
/**
 * Error for unexpected issues or invalid responses from the DigitalOcean API.
 */ export class DigitalOceanUnexpectedResponseError extends DigitalOceanServiceError {
  constructor(message = "Unexpected response from DigitalOcean API.", originalError){
    super(message, originalError);
  }
}
