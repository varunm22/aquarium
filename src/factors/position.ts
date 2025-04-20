import { Factor } from './factor.js';
import { Vector } from '../vector.js';

export class Position extends Factor<Vector> {
    private accelerationDuration: number = 0;
    private originalDdelta: Vector = Vector.zero();

    constructor(value: Vector, delta: Vector) {
        super(value, delta);
    }

    get x(): number {
        return this.value.x;
    }

    set x(newX: number) {
        this.value.x = newX;
    }

    get y(): number {
        return this.value.y;
    }

    set y(newY: number) {
        this.value.y = newY;
    }

    get z(): number {
        return this.value.z;
    }

    set z(newZ: number) {
        this.value.z = newZ;
    }

    applyAcceleration(acceleration: Vector, duration: number): void {
        this.originalDdelta = this.ddelta;
        this.ddelta = acceleration;
        this.accelerationDuration = duration;
    }

    update(): void {
        super.update();
        
        // Constrain position to tank bounds
        const constrained = this.value.constrainVector(
            new Vector(150, 200, 20),
            new Vector(850, 650, 400)
        );

        // Check if we're at any boundaries and bounce accordingly
        if (constrained.x !== this.value.x) {
            this.delta.x *= -1;
            this.ddelta.x *= -1;  // Also reflect the acceleration
        }
        if (constrained.y !== this.value.y) {
            this.delta.y *= -1;
            this.ddelta.y *= -1;  // Also reflect the acceleration
        }
        if (constrained.z !== this.value.z) {
            this.delta.z *= -1;
            this.ddelta.z *= -1;  // Also reflect the acceleration
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