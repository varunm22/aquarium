import { Inhabitant } from './inhabitant.js';
import { Vector } from './vector.js';
import { UserFish } from './userfish.js';
import { Position } from './factors/position.js';
export class Fish extends Inhabitant {
    constructor(x, y, z, size) {
        const position = new Position(new Vector(x, y, z), Vector.random(-1, 1));
        super(position, size);
    }
    update(inhabitants) {
        // React to other fish within the field of view
        const fish_in_view = [];
        const fish_in_proximity = [];
        for (let other of inhabitants) {
            if (other !== this) {
                if (this.isInFieldOfView(other, 45, 200)) {
                    fish_in_view.push(other);
                }
                else if (this.distanceTo(other) <= 50) { // Check proximity if not in view
                    fish_in_proximity.push(other);
                }
            }
        }
        this.reactToAllFish(fish_in_view, fish_in_proximity);
        super.update(inhabitants);
    }
    calculateAttractionForce(other, maxSpeed, multiplier) {
        const direction = other.position.value.subtract(this.position.value);
        const distance = direction.magnitude();
        direction.divideInPlace(distance);
        direction.multiplyInPlace(distance * multiplier);
        if (direction.magnitude() > maxSpeed) {
            direction.multiplyInPlace(maxSpeed / direction.magnitude());
        }
        return direction;
    }
    calculateRepulsionForce(other, maxSpeed, multiplier) {
        const direction = other.position.value.subtract(this.position.value);
        const distance = direction.magnitude();
        direction.divideInPlace(distance);
        direction.multiplyInPlace(-multiplier / (distance * distance));
        if (direction.magnitude() > maxSpeed) {
            direction.multiplyInPlace(maxSpeed / direction.magnitude());
        }
        return direction;
    }
    reactToAllFish(fish_in_view, fish_in_proximity) {
        // Reset ddelta to ensure clean force application
        this.position.ddelta = Vector.zero();
        let totalForce = Vector.zero();
        let can_see_user_fish = false;
        // Handle fish in visual range
        for (let other of fish_in_view) {
            if (other instanceof UserFish) {
                can_see_user_fish = true;
                // Strong attraction to user fish
                totalForce.addInPlace(this.calculateAttractionForce(other, 0.1, 0.001));
            }
            else {
                const distance = this.distanceTo(other);
                if (distance > 150) {
                    // Weak attraction to other fish when far
                    totalForce.addInPlace(this.calculateAttractionForce(other, 0.1, 0.001));
                }
                else if (distance < 100) {
                    // Strong repulsion from other fish when close
                    totalForce.addInPlace(this.calculateRepulsionForce(other, 0.1, 0.1));
                }
            }
        }
        // Handle fish in proximity but not in view
        for (let other of fish_in_proximity) {
            if (other instanceof Fish) { // Only react to regular Fish
                // Strong repulsion from fish detected by proximity
                totalForce.addInPlace(this.calculateRepulsionForce(other, 0.5, 1));
            }
        }
        if (!can_see_user_fish) {
            // Add some random movement when no user fish in view
            totalForce.addInPlace(Vector.random(-0.1, 0.1));
        }
        // Apply the combined force
        this.position.applyAcceleration(totalForce, 1);
    }
    render(tank) {
        super.render(tank, color(255, 200, 0)); // Render as yellow
    }
}
