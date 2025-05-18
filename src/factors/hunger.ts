import { Factor } from './factor.js';

export class Hunger extends Factor<number> {
    private increaseRate: number;

    constructor(value: number = 0, delta: number = 0) {
        super(value, delta);
        this.increaseRate = 0;
    }

    update(): void {
        super.update();
        
        // Randomly increase hunger at a slow rate
        this.increaseRate = Math.random() * 0.0009 + 0.0001; // Random between 0.0001 and 0.001
        this.value = Math.min(1, this.value + this.increaseRate);
        
        // Constrain hunger to reasonable bounds
        this.value = Math.max(0, Math.min(this.value, 1));
    }
} 