import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.body) {
      request.body = this.transformObjectKeys(request.body, true);
    }

    return next.handle().pipe(
      map(data => this.transformObjectKeys(data, false)),
    );
  }

  private transformObjectKeys(obj: any, snakeToCamel: boolean): any {
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        return obj.map(item => this.transformObjectKeys(item, snakeToCamel));
      } else {
        const transformedObject = {};

        for (const key of Object.keys(obj)) {
          const transformedKey = snakeToCamel ? this.toCamelCase(key) : this.toSnakeCase(key);
          transformedObject[transformedKey] = this.transformObjectKeys(obj[key], snakeToCamel);
        }

        return transformedObject;
      }
    } else {
      return obj;
    }
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
