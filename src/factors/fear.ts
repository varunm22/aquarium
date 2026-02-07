import { Factor } from './factor.js';
import { Vector } from '../vector.js';

export class Fear extends Factor<number> {
    private direction: Vector;
    private decayRate: number;

    constructor(value: number = 0, delta: number = 0, decayRate: number = 0.002) {
        super(value, delta);
        this.direction = Vector.zero();
        this.decayRate = decayRate;
    }

    update(): void {
        super.update();
        if (this.value > 0) {
            this.value = Math.max(0, this.value - this.decayRate);
        }
        this.value = Math.max(0, Math.min(this.value, 1));
    }

    setDirection(direction: Vector): void {
        const magnitude = direction.magnitude();
        this.direction = magnitude > 0 ? direction.divide(magnitude) : Vector.zero();
    }

    getDirection(): Vector { return this.direction; }

    increase(amount: number, direction?: Vector): void {
        this.value = Math.min(1, this.value + amount);
        if (direction) this.setDirection(direction);
    }
}
