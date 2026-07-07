import { Injectable } from '@nestjs/common';
import type { IRandomizer } from '../domain/randomizer.interface';

@Injectable()
export class RandomProvider implements IRandomizer {
  roll(sides: number): number {
    return Math.floor(Math.random() * sides) + 1;
  }

  pick<T>(pool: T[]): T {
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
