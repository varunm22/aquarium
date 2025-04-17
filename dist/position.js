import { Vector } from './vector.js';
export class Position {
    constructor(value, delta) {
        this.value = value;
        this.delta = delta;
        this.ddelta = Vector.zero();
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
        this.value = this.value.add(this.delta);
        this.delta = this.delta.add(this.ddelta);
        // Constrain position to the tank bounds
        this.value = this.value.constrainVector(new Vector(150, 200, 20), new Vector(850, 650, 400));
        // Speed decay
        this.delta = this.delta.multiply(0.95);
    }
}
