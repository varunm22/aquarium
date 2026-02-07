import { Vector } from '../vector.js';
export class Factor {
    constructor(value, delta) {
        this.value = value;
        this.delta = delta;
        this.ddelta = (typeof value === 'number' ? 0 : Vector.zero());
    }
    update() {
        if (typeof this.value === 'number') {
            this.value = (this.value + this.delta);
            this.delta = (this.delta + this.ddelta);
        }
        else {
            this.value.addInPlace(this.delta);
            this.delta.addInPlace(this.ddelta);
        }
    }
}
