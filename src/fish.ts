import { Inhabitant } from './inhabitant.js';
import { Vector } from './vector.js';
import { UserFish } from './userfish.js';
import { Tank } from './tank.js';
import { Position } from './factors/position.js';

// Declare p5.js global functions
declare function color(r: number, g: number, b: number): p5.Color;

// Declare p5.Color type
declare namespace p5 {
  interface Color {}
}

export class Fish extends Inhabitant {
    constructor(x: number, y: number, z: number, size: number) {
      const position = new Position(new Vector(x, y, z), Vector.random(-1, 1));
      super(position, size);
    }
  
    update(inhabitants: Inhabitant[]): void {
      // React to other fish within the field of view
      const fish_in_view: Inhabitant[] = [];
      const fish_in_proximity: Inhabitant[] = [];
      
      for (let other of inhabitants) {
        if (other !== this) {
          if (this.isInFieldOfView(other, 45, 200)) {
            fish_in_view.push(other);
          } else if (this.distanceTo(other) <= 50) { // Check proximity if not in view
            fish_in_proximity.push(other);
          }
        }
      }

      this.reactToAllFish(fish_in_view, fish_in_proximity);
      super.update(inhabitants);
    }

    private calculateAttractionForce(other: Inhabitant, maxSpeed: number, multiplier: number): Vector {
      const direction = other.position.value.subtract(this.position.value);
      const distance = direction.magnitude();
      direction.divideInPlace(distance);
      direction.multiplyInPlace(distance * multiplier);
      if (direction.magnitude() > maxSpeed) {
        direction.multiplyInPlace(maxSpeed / direction.magnitude());
      }
      return direction;
    }

    private calculateRepulsionForce(other: Inhabitant, maxSpeed: number, multiplier: number): Vector {
      const direction = other.position.value.subtract(this.position.value);
      const distance = direction.magnitude();
      direction.divideInPlace(distance);
      direction.multiplyInPlace(-multiplier / (distance * distance));
      if (direction.magnitude() > maxSpeed) {
        direction.multiplyInPlace(maxSpeed / direction.magnitude());
      }
      return direction;
    }

    reactToAllFish(fish_in_view: Inhabitant[], fish_in_proximity: Inhabitant[]): void {
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
        } else {
          const distance = this.distanceTo(other);
          if (distance > 150) {
            // Weak attraction to other fish when far
            totalForce.addInPlace(this.calculateAttractionForce(other, 0.1, 0.001));
          } else if (distance < 100) {
            // Strong repulsion from other fish when close
            totalForce.addInPlace(this.calculateRepulsionForce(other, 0.1, 0.1));
          }
        }
      }

      // Handle fish in proximity but not in view
      for (let other of fish_in_proximity) {
        if (other instanceof Fish) {  // Only react to regular Fish
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

    render(tank: Tank): void {
      super.render(tank, color(255, 200, 0)); // Render as yellow
    }
}
  