import { Factor } from './factor.js';
import { Vector } from '../vector.js';

export class Position extends Factor<Vector> {
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

    update(): void {
        super.update();
        
        // Constrain position to tank bounds
        this.value = this.value.constrainVector(
            new Vector(150, 200, 20),
            new Vector(850, 650, 400)
        );

        // Apply speed decay
        this.delta = this.delta.multiply(0.95);
    }
} 