import { Factor } from './factor.js';

// TODO: Implement initiative
export class Initiative extends Factor<number> {
    constructor(value: number = 0, delta: number = 0) {
        super(value, delta);
    }

    update(): void {
        super.update();
        
        // Constrain initiative to reasonable bounds
        this.value = Math.max(0, Math.min(this.value, 1));
    }
} 