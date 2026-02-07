import { Factor } from './factor.js';
import { Vector } from '../vector.js';
import { getTankBounds } from '../constants.js';
export class Position extends Factor {
    constructor(value, delta, shouldConstrain = true, decay = 0.96) {
        super(value, delta);
        this.accelerationDuration = 0;
        this.shouldConstrain = shouldConstrain;
        this.decay = decay;
    }
    get x() { return this.value.x; }
    set x(newX) { this.value.x = newX; }
    get y() { return this.value.y; }
    set y(newY) { this.value.y = newY; }
    get z() { return this.value.z; }
    set z(newZ) { this.value.z = newZ; }
    setShouldConstrain(shouldConstrain) {
        this.shouldConstrain = shouldConstrain;
    }
    applyAcceleration(acceleration, duration) {
        this.ddelta = acceleration;
        this.accelerationDuration = duration;
    }
    /** Wall avoidance: force proportional to velocity/distance (inversely proportional to collision time).
     *  Only activates when heading towards a wall within 50 units. Does not avoid the water surface. */
    calculateWallAvoidanceForce() {
        const bounds = getTankBounds();
        const avoidanceDistance = 50;
        const forceMultiplier = 100;
        let avoidanceForce = Vector.zero();
        const boundaries = [
            [this.value.x, bounds.min.x, new Vector(1, 0, 0), this.delta.x, (vel) => vel < -0.5],
            [this.value.x, bounds.max.x, new Vector(-1, 0, 0), this.delta.x, (vel) => vel > 0.5],
            [this.value.y, bounds.max.y, new Vector(0, -1, 0), this.delta.y, (vel) => vel > 0.5],
            [this.value.z, bounds.min.z, new Vector(0, 0, 1), this.delta.z, (vel) => vel < -0.5],
            [this.value.z, bounds.max.z, new Vector(0, 0, -1), this.delta.z, (vel) => vel > 0.5]
        ];
        for (const [pos, boundary, direction, velocity, isMovingTowards] of boundaries) {
            const distance = Math.abs(pos - boundary);
            if (distance < avoidanceDistance && isMovingTowards(velocity)) {
                const strength = Math.min(Math.abs(velocity) / distance, 1.0);
                avoidanceForce.addInPlace(direction.multiply(strength * forceMultiplier));
            }
        }
        return avoidanceForce;
    }
    update() {
        super.update();
        if (this.shouldConstrain) {
            const bounds = getTankBounds();
            const wallAvoidanceForce = this.calculateWallAvoidanceForce();
            if (wallAvoidanceForce.magnitude() > 0) {
                this.applyAcceleration(wallAvoidanceForce, 1);
            }
            const constrained = this.value.constrainVector(bounds.min, bounds.max);
            // Bounce when hitting boundaries
            if (constrained.x !== this.value.x) {
                this.delta.x *= -1;
                this.ddelta.x *= -1;
            }
            if (constrained.y !== this.value.y) {
                this.delta.y *= -1;
                this.ddelta.y *= -1;
            }
            if (constrained.z !== this.value.z) {
                this.delta.z *= -1;
                this.ddelta.z *= -1;
            }
            this.value = constrained;
        }
        if (this.accelerationDuration > 0) {
            this.accelerationDuration--;
            if (this.accelerationDuration === 0) {
                this.ddelta = Vector.zero();
            }
        }
        this.delta.multiplyInPlace(this.decay);
    }
}
