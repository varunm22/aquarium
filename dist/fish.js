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
        for (let other of inhabitants) {
            if (other !== this && this.isInFieldOfView(other, 45, 200)) {
                fish_in_view.push(other);
            }
        }
        this.reactToAllFish(fish_in_view);
        super.update(inhabitants);
    }
    reactToAllFish(fish_in_view) {
        let can_see_user_fish = false;
        for (let other of fish_in_view) {
            if (other instanceof UserFish) {
                can_see_user_fish = true;
                this.reactToFish(other);
            }
            else {
                this.reactToFish(other);
            }
        }
        if (!can_see_user_fish) {
            this.position.delta = Vector.random(-1, 1);
        }
    }
    reactToFish(other) {
        // Basic behavior: move towards other fish if too far
        const distance = this.distanceTo(other);
        if (other instanceof UserFish) {
            this.moveTowards(other);
        }
        else {
            if (distance > 100) { // If too far
                this.moveTowards(other, 1, 1);
            }
            else if (distance < 50) { // If too close
                // TODO: this is not working, maybe need to only look at our type fish?
                // actually should include fish that are not in sight but in proximity
                this.moveFrom(other, 2, 1);
            }
        }
    }
    render(tank) {
        super.render(tank, color(255, 200, 0)); // Render as yellow
    }
}
