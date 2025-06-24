import { Factor } from './factor.js';
import { Vector } from '../vector.js';
import { getTankBounds } from '../constants.js';

export class Position extends Factor<Vector> {
    private accelerationDuration: number = 0;
    private shouldConstrain: boolean;

    constructor(value: Vector, delta: Vector, shouldConstrain: boolean = true) {
        super(value, delta);
        this.shouldConstrain = shouldConstrain;
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

    setShouldConstrain(shouldConstrain: boolean): void {
        this.shouldConstrain = shouldConstrain;
    }

    applyAcceleration(acceleration: Vector, duration: number): void {
        this.ddelta = acceleration;
        this.accelerationDuration = duration;
    }

    /**
     * Calculates wall avoidance force when within 50 units of walls or floor
     * Does not avoid the water surface (top boundary)
     * Only activates when velocity is heading towards the wall
     * Force is proportional to velocity/distance (inversely proportional to collision time)
     */
    private calculateWallAvoidanceForce(): Vector {
        const bounds = getTankBounds();
        const avoidanceDistance = 50;
        const forceMultiplier = 100;
        let avoidanceForce = Vector.zero();

        // Define boundaries: [position, boundaryValue, forceDirection, velocityComponent, movingTowardsCondition]
        const boundaries: [number, number, Vector, number, (vel: number) => boolean][] = [
            [this.value.x, bounds.min.x, new Vector(1, 0, 0), this.delta.x, (vel) => vel < -0.5],   // Left wall
            [this.value.x, bounds.max.x, new Vector(-1, 0, 0), this.delta.x, (vel) => vel > 0.5],  // Right wall
            [this.value.y, bounds.max.y, new Vector(0, -1, 0), this.delta.y, (vel) => vel > 0.5],  // Floor only
            [this.value.z, bounds.min.z, new Vector(0, 0, 1), this.delta.z, (vel) => vel < -0.5],   // Back wall
            [this.value.z, bounds.max.z, new Vector(0, 0, -1), this.delta.z, (vel) => vel > 0.5]   // Front wall
        ];

        for (const [pos, boundary, direction, velocity, isMovingTowards] of boundaries) {
            const distance = Math.abs(pos - boundary);
            if (distance < avoidanceDistance && isMovingTowards(velocity)) {
                // Strength is proportional to velocity/distance (inversely proportional to collision time)
                const velocityTowardsWall = Math.abs(velocity);
                const strength = Math.min(velocityTowardsWall / distance, 1.0); // Cap at 1.0 to prevent extreme forces
                const force = direction.multiply(strength * forceMultiplier);
                avoidanceForce.addInPlace(force);
            }
        }

        return avoidanceForce;
    }

    update(): void {
        super.update();
        
        if (this.shouldConstrain) {
            const bounds = getTankBounds();
            
            // Apply wall avoidance force before boundary constraints
            const wallAvoidanceForce = this.calculateWallAvoidanceForce();
            if (wallAvoidanceForce.magnitude() > 0) {
                this.applyAcceleration(wallAvoidanceForce, 1);
            }
            
            const constrained = this.value.constrainVector(
                bounds.min,
                bounds.max
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
        }

        // Handle temporary acceleration duration
        if (this.accelerationDuration > 0) {
            this.accelerationDuration--;
            if (this.accelerationDuration === 0) {
                this.ddelta = Vector.zero();
            }
        }

        // Apply speed decay
        this.delta.multiplyInPlace(0.96);
    }
} 