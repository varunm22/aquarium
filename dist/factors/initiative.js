import { Factor } from './factor.js';
// TODO: Implement initiative
export class Initiative extends Factor {
    constructor(value = 0, delta = 0) {
        super(value, delta);
    }
    update() {
        super.update();
        // Constrain initiative to reasonable bounds
        this.value = Math.max(0, Math.min(this.value, 100));
    }
}
