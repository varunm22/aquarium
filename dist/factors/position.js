import { Factor } from './factor.js';
import { Vector } from '../vector.js';
export class Position extends Factor {
    constructor(value, delta) {
        super(value, delta);
    }
    get x() {
        return this.value.x;
    }
    set x(newX) {
        this.value.x = newX;
    }
    get y() {
        return this.value.y;
    }
    set y(newY) {
        this.value.y = newY;
    }
    get z() {
        return this.value.z;
    }
    set z(newZ) {
        this.value.z = newZ;
    }
    update() {
        super.update();
        // Constrain position to tank bounds
        this.value = this.value.constrainVector(new Vector(150, 200, 20), new Vector(850, 650, 400));
        // Apply speed decay
        this.delta = this.delta.multiply(0.95);
    }
}
