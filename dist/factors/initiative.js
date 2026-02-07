import { Factor } from './factor.js';
export class Initiative extends Factor {
    constructor(value = 0, delta = 0) {
        super(value, delta);
    }
    update() {
        super.update();
        this.value = Math.max(0, Math.min(this.value, 1));
    }
}
