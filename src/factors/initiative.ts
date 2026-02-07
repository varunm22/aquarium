import { Factor } from './factor.js';

export class Initiative extends Factor<number> {
    constructor(value: number = 0, delta: number = 0) {
        super(value, delta);
    }

    update(): void {
        super.update();
        this.value = Math.max(0, Math.min(this.value, 1));
    }
}
