import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateEmployeeCredentialsDto {
  @IsEmail()
  email!: string;

  // Passwords are never returned by the API. Omitting it on an existing
  // credential record keeps the current password while allowing an email
  // update; new records must provide one.
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
