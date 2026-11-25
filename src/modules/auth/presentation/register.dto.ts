import { IsDefined, IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * The `pattern` of `displayName` in `docs/contracts/schemas/common.schema.json` (RN-COM-109, D-50): letters
 * (also accented Latin ones), digits, space, `_`, `-` and `.`, with no space at either end.
 */
export const DISPLAY_NAME_PATTERN =
  /^[A-Za-z0-9À-ÖØ-öø-ÿ_.-][A-Za-z0-9À-ÖØ-öø-ÿ_. -]*[A-Za-z0-9À-ÖØ-öø-ÿ_.-]$/;

/**
 * Body of `POST /v1/auth/register` (`RegisterRequest` of the contract). The global pipe rejects any other
 * property, `role` included (SEC-API-03). The password has no length rule here: the domain applies the whole
 * policy of D-52 (counting characters, not UTF-16 units) and the 100 KB limit of the body bounds its size.
 */
export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsDefined()
  @IsString()
  password!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(DISPLAY_NAME_PATTERN)
  displayName!: string;
}
