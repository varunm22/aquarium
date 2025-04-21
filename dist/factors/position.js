import { Factor } from './factor.js';
import { Vector } from '../vector.js';
import { getTankBounds } from '../constants.js';
export class Position extends Factor {
    constructor(value, delta) {
        super(value, delta);
        this.accelerationDuration = 0;
        this.originalDdelta = Vector.zero();
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
    applyAcceleration(acceleration, duration) {
        this.originalDdelta = this.ddelta;
        this.ddelta = acceleration;
        this.accelerationDuration = duration;
    }
    update() {
        super.update();
        const bounds = getTankBounds();
        const constrained = this.value.constrainVector(bounds.min, bounds.max);
        // Check if we're at any boundaries and bounce accordingly
        if (constrained.x !== this.value.x) {
            this.delta.x *= -1;
            this.ddelta.x *= -1; // Also reflect the acceleration
        }
        if (constrained.y !== this.value.y) {
            this.delta.y *= -1;
            this.ddelta.y *= -1; // Also reflect the acceleration
        }
        if (constrained.z !== this.value.z) {
            this.delta.z *= -1;
            this.ddelta.z *= -1; // Also reflect the acceleration
        }
        this.value = constrained;
        // Handle temporary acceleration duration
        if (this.accelerationDuration > 0) {
            this.accelerationDuration--;
            if (this.accelerationDuration === 0) {
                this.ddelta = this.originalDdelta;
            }
        }
        // Apply speed decay
        this.delta.multiplyInPlace(0.95);
    }
}
