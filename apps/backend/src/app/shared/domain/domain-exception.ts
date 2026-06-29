/**
 * Exception métier levée par le domaine quand une règle est violée.
 * Distincte de HttpException (NestJS) : le domaine ne connaît pas HTTP.
 * Capturée par la couche application et convertie en BadRequestException / ForbiddenException.
 */
export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainException';
  }
}
