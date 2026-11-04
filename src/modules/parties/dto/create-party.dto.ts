import { IsEmail, IsEnum, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { OptionalBlank } from '#common/validation/optional-blank.decorator.js';
import { Trim } from '#common/validation/trim.decorator.js';
import { PHONE_PATTERN } from '#common/validation/phone.constants.js';
import { PartyType } from '#generated/prisma/client.js';

/** Non-negative amount with up to 2 decimals. */
export const AMOUNT_PATTERN = /^\d{1,16}(\.\d{1,2})?$/;

export class CreatePartyDto {
  /** Customer, supplier, or both. */
  @IsEnum(PartyType)
  type!: PartyType;

  /**
   * Optional business code, unique within the organization.
   * @example "CUS-0001"
   */
  @OptionalBlank()
  @Trim()
  @IsString()
  @MaxLength(50)
  code?: string;

  /**
   * Display name.
   * @example "Boutique An Nhiên"
   */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  /** @example "0283910011" */
  @OptionalBlank()
  @Trim()
  @Matches(PHONE_PATTERN, { message: 'validation.INVALID_PHONE' })
  phone?: string;

  /**
   * Stored lower-cased.
   * @example "contact@an-nhien.vn"
   */
  @OptionalBlank()
  @Trim()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  /** @example "0312345678" */
  @OptionalBlank()
  @Trim()
  @IsString()
  @MaxLength(20)
  taxCode?: string;

  @OptionalBlank()
  @Trim()
  @IsString()
  @MaxLength(500)
  address?: string;

  @OptionalBlank()
  @Trim()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /**
   * Province code, stored upper-case.
   * @example "HCM"
   */
  @OptionalBlank()
  @Trim()
  @IsString()
  @MaxLength(10)
  provinceCode?: string;

  /** @example "TP. Hồ Chí Minh" */
  @OptionalBlank()
  @Trim()
  @IsString()
  @MaxLength(100)
  provinceName?: string;

  /**
   * Maximum outstanding receivable allowed for this party, as a decimal string (>= 0).
   * @example "50000000"
   */
  @OptionalBlank()
  @Trim()
  @Matches(AMOUNT_PATTERN, { message: 'validation.INVALID_AMOUNT' })
  creditLimit?: string;

  /** Id of an active member of the organization responsible for this party. */
  @OptionalBlank()
  @Trim()
  @IsString()
  assignedToId?: string;
}
