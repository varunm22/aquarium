import { Factor } from './factor.js';
import { Vector } from '../vector.js';
export class Fear extends Factor {
    constructor(value = 0, delta = 0, decayRate = 0.005) {
        super(value, delta);
        this.direction = Vector.zero();
        this.decayRate = decayRate;
    }
    update() {
        super.update();
        // Apply linear decay if fear is above 0
        if (this.value > 0) {
            this.value = Math.max(0, this.value - this.decayRate);
        }
        // Constrain fear to reasonable bounds
        this.value = Math.max(0, Math.min(this.value, 1));
    }
    setDirection(direction) {
        const magnitude = direction.magnitude();
        if (magnitude > 0) {
            this.direction = direction.divide(magnitude);
        }
        else {
            this.direction = Vector.zero();
        }
    }
    getDirection() {
        return this.direction;
    }
    increase(amount, direction) {
        this.value = Math.min(1, this.value + amount);
        if (direction) {
            this.setDirection(direction);
        }
    }
}
