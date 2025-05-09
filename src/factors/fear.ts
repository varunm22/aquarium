import { Factor } from './factor.js';
import { Vector } from '../vector.js';

export class Fear extends Factor<number> {
    private direction: Vector;
    private decayRate: number;

    constructor(value: number = 0, delta: number = 0, decayRate: number = 0.1) {
        super(value, delta);
        this.direction = Vector.zero();
        this.decayRate = decayRate;
    }

    update(): void {
        super.update();
        
        // Apply linear decay if fear is above 0
        if (this.value > 0) {
            this.value = Math.max(0, this.value - this.decayRate);
        }
        
        // Constrain fear to reasonable bounds
        this.value = Math.max(0, Math.min(this.value, 1));
    }

    setDirection(direction: Vector): void {
        const magnitude = direction.magnitude();
        if (magnitude > 0) {
            this.direction = direction.divide(magnitude);
        } else {
            this.direction = Vector.zero();
        }
    }

    getDirection(): Vector {
        return this.direction;
    }

    increase(amount: number, direction?: Vector): void {
        this.value = Math.min(1, this.value + amount);
        if (direction) {
            this.setDirection(direction);
        }
    }
} 