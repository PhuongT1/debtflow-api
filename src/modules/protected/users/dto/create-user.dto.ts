import {
  IsByteLength,
  IsEmail,
  IsEnum,
  IsOptional,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Trim } from '@common/validation/trim.decorator';
import { PHONE_PATTERN } from '@modules/protected/parties/dto/create-party.dto';
import { OrganizationRole } from '@generated/prisma';

/** At least one letter and one digit, 8 to 72 characters (the bcrypt input limit). */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

export class CreateUserDto {
  /** @example "Tran Thi B" */
  @Trim()
  @Length(2, 100)
  name!: string;

  /**
   * Login email. Stored lower-cased; must not belong to another account.
   * @example "b.tran@an-phu.vn"
   */
  @Trim()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** @example "0901234567" */
  @IsOptional()
  @Trim()
  @Matches(PHONE_PATTERN, { message: 'validation.INVALID_PHONE' })
  phone?: string;

  /** Initial password, hashed before storage. 8-72 characters with a letter and a digit. */
  @Matches(PASSWORD_PATTERN, { message: 'validation.INVALID_PASSWORD' })
  @IsByteLength(8, 72, { message: 'validation.INVALID_PASSWORD' })
  password!: string;

  /** Role in this organization. Only an OWNER can create another OWNER. */
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
