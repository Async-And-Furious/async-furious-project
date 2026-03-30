import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CsrfService {
  readonly cookieName = process.env.CSRF_COOKIE_NAME || 'CSRF-TOKEN';
  private readonly secret: string;

  constructor() {
    this.secret = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
  }

  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  validateToken(token: string): boolean {
    if (!token || !this.secret) return false;
    try {
      const [secretPart, tokenPart] = token.split('-');
      if (secretPart !== this.secret.substring(0, 8)) return false;
      return tokenPart.length === 64;
    } catch {
      return false;
    }
  }

  createToken(): string {
    const randomPart = crypto.randomBytes(32).toString('hex');
    return `${this.secret.substring(0, 8)}-${randomPart}`;
  }

  getCookieOptions(token: string) {
    return {
      name: this.cookieName,
      value: token,
      sameSite: 'lax' as const,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    };
  }
}
