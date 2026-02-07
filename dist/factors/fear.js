import { Factor } from './factor.js';
import { Vector } from '../vector.js';
export class Fear extends Factor {
    constructor(value = 0, delta = 0, decayRate = 0.002) {
        super(value, delta);
        this.direction = Vector.zero();
        this.decayRate = decayRate;
    }
    update() {
        super.update();
        if (this.value > 0) {
            this.value = Math.max(0, this.value - this.decayRate);
        }
        this.value = Math.max(0, Math.min(this.value, 1));
    }
    setDirection(direction) {
        const magnitude = direction.magnitude();
        this.direction = magnitude > 0 ? direction.divide(magnitude) : Vector.zero();
    }
    getDirection() { return this.direction; }
    increase(amount, direction) {
        this.value = Math.min(1, this.value + amount);
        if (direction)
            this.setDirection(direction);
    }
}
