import { Logger } from '@nestjs/common';

export function LogUseCase(): MethodDecorator {
  return (_target, _propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    descriptor.value = async function (...args: unknown[]) {
      const className = (this as { constructor: { name: string } }).constructor.name;
      const logger = new Logger(className);
      const start = Date.now();
      logger.log(`execute() ← ${JSON.stringify(args[0] ?? args)}`);
      try {
        const result = await original.apply(this, args);
        logger.log(`execute() → ${JSON.stringify(result)} (${Date.now() - start}ms)`);
        return result;
      } catch (e) {
        logger.error(`execute() ✗ ${(e as Error).message} (${Date.now() - start}ms)`);
        throw e;
      }
    };
    return descriptor;
  };
}
