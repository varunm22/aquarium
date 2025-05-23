import { Factor } from './factor.js';
import { Inhabitant } from '../inhabitants/inhabitant.js';

export class Hunger extends Factor<number> {
    private increaseRate: number;
    public inStrike: boolean;
    public target: Inhabitant | null;
    public isEating: number;

    constructor(value: number = 0, delta: number = 0) {
        super(value, delta);
        this.increaseRate = 0;
        this.inStrike = false;
        this.target = null;
        this.isEating = 0;
    }

    update(): void {
        super.update();
        
        // Randomly increase hunger at a slow rate
        this.increaseRate = Math.random() * 0.0009 + 0.0001; // Random between 0.0001 and 0.001
        this.value = Math.min(1, this.value + this.increaseRate);
        
        // Constrain hunger to reasonable bounds
        this.value = Math.max(0, Math.min(this.value, 1));

        // Decrease isEating counter if active
        if (this.isEating > 0) {
            this.isEating--;
        }
    }

    startStrike(target: Inhabitant): void {
        this.inStrike = true;
        this.target = target;
    }

    endStrike(): void {
        this.inStrike = false;
        this.target = null;
    }

    startEating(): void {
        this.isEating = 30;
    }
} 