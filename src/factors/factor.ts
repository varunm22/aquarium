import { Vector } from '../vector.js';

export class Factor<T extends Vector | number> {
    value: T;
    delta: T;
    ddelta: T;

    constructor(value: T, delta: T) {
        this.value = value;
        this.delta = delta;
        this.ddelta = (typeof value === 'number' ? 0 : Vector.zero()) as T;
    }

    update(): void {
        if (typeof this.value === 'number') {
            const v = this.value as number;
            const d = this.delta as number;
            const dd = this.ddelta as number;
            this.value = (v + d) as T;
            this.delta = (d + dd) as T;
        } else {
            (this.value as Vector).addInPlace(this.delta as Vector);
            (this.delta as Vector).addInPlace(this.ddelta as Vector);
        }
    }
} 