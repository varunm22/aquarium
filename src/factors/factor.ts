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
            this.value = ((this.value as number) + (this.delta as number)) as T;
            this.delta = ((this.delta as number) + (this.ddelta as number)) as T;
        } else {
            (this.value as Vector).addInPlace(this.delta as Vector);
            (this.delta as Vector).addInPlace(this.ddelta as Vector);
        }
    }
}
