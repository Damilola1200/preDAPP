import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from './roles.decorator';
@Injectable()
export class RolesGuard implements CanActivate {
 constructor(private readonly reflector: Reflector) {}
 canActivate(context: ExecutionContext) {
  const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
  if (!required?.length) return true;
  const request = context.switchToHttp().getRequest<{ user?: { roles?: string[] } }>();
  if (!request.user?.roles?.some(role => required.includes(role as Role))) throw new ForbiddenException();
  return true;
 }
}
