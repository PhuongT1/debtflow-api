import { HttpException, HttpStatus, ValidationError } from '@nestjs/common';

type ValidationErrorContext = {
  code?: string;
  statusCode?: number;
};

type ApiValidationError = {
  field: string;
  message: string;
  code: string;
  /** Translation key resolved by ApiExceptionFilter; removed before the response is sent. */
  key: string;
};

const DEFAULT_VALIDATION_CODE = 'VALIDATION_ERROR';
const DEFAULT_VALIDATION_STATUS = HttpStatus.BAD_REQUEST;

export function createValidationException(errors: ValidationError[]) {
  const validationErrors = formatValidationErrors(errors);
  const firstError = validationErrors[0];
  const statusCode = getStatusCode(errors) ?? DEFAULT_VALIDATION_STATUS;

  return new HttpException(
    {
      success: false,
      code: firstError?.code ?? DEFAULT_VALIDATION_CODE,
      message: firstError?.message ?? DEFAULT_VALIDATION_CODE,
      errors: validationErrors,
      statusCode,
    },
    statusCode,
  );
}

function formatValidationErrors(errors: ValidationError[], parentPath = ''): ApiValidationError[] {
  return errors.flatMap((error): ApiValidationError[] => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownErrors = Object.entries(error.constraints ?? {}).map(([constraintName, message]) => {
      const context = getConstraintContext(error, constraintName);
      // A message that is already a key (validation.XXX) is kept; class-validator's default
      // English text is replaced by the key of the failed constraint so it can be localized.
      const key = message.startsWith('validation.') ? message : `validation.${constraintName}`;

      return {
        field,
        message,
        key,
        code:
          context?.code ??
          (message.startsWith('validation.') ? key.split('.').pop()! : DEFAULT_VALIDATION_CODE),
      };
    });
    const childErrors = error.children?.length ? formatValidationErrors(error.children, field) : [];

    return [...ownErrors, ...childErrors];
  });
}

function getStatusCode(errors: ValidationError[]): number | undefined {
  for (const error of errors) {
    for (const constraintName of Object.keys(error.constraints ?? {})) {
      const statusCode = getConstraintContext(error, constraintName)?.statusCode;

      if (statusCode) return statusCode;
    }

    const childStatusCode = error.children?.length ? getStatusCode(error.children) : undefined;

    if (childStatusCode) return childStatusCode;
  }

  return undefined;
}

function getConstraintContext(
  error: ValidationError,
  constraintName: string,
): ValidationErrorContext | undefined {
  return error.contexts?.[constraintName] as ValidationErrorContext | undefined;
}
