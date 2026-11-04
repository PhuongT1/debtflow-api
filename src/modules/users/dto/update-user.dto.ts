import { IsEnum, Matches, ValidateIf, Length } from 'class-validator';
import { Trim } from '@common/validation/trim.decorator.js';
import { PHONE_PATTERN } from '@common/validation/phone.constants.js';
import { OrganizationRole } from '@generated/prisma/client.js';

export class UpdateUserDto {
  /**
   * Full name. Editable only when the account belongs to this organization alone (or by the user themselves).
   * @example "Nguyen Van A"
   */
  @ValidateIf((_object, value) => value !== undefined)
  @Trim()
  @Length(2, 100)
  name?: string;

  /**
   * Phone number, `null` clears it. Same restriction as `name`.
   * @example "0901234567"
   */
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Trim()
  @Matches(PHONE_PATTERN, { message: 'validation.INVALID_PHONE' })
  phone?: string | null;

  /** New role in this organization. Granting or removing OWNER requires an OWNER, and you cannot change your own role. */
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;
}
