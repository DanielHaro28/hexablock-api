import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body of `POST /v1/auth/login` (`LoginRequest` of the contract). Unlike registration, the password rules of
 * D-52 are not applied: an old password must still be able to log in. The 128 characters of the limit bound
 * the cost of the hash.
 */
export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
