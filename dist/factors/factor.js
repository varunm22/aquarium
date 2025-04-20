import { Vector } from '../vector.js';
export class Factor {
    constructor(value, delta) {
        this.value = value;
        this.delta = delta;
        this.ddelta = (typeof value === 'number' ? 0 : Vector.zero());
    }
    update() {
        if (typeof this.value === 'number') {
            const v = this.value;
            const d = this.delta;
            const dd = this.ddelta;
            this.value = (v + d);
            this.delta = (d + dd);
        }
        else {
            this.value.addInPlace(this.delta);
            this.delta.addInPlace(this.ddelta);
        }
    }
}
