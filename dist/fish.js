import { Inhabitant } from './inhabitant.js';
import { Vector } from './vector.js';
import { Position } from './factors/position.js';
import { Initiative } from './factors/initiative.js';
import { Fear } from './factors/fear.js';
import { getTankBounds } from './constants.js';
export class Fish extends Inhabitant {
    constructor(x, y, z, size) {
        const position = new Position(new Vector(x, y, z), Vector.random(-1, 1), false);
        super(position, size);
        this.initiative = new Initiative(0);
        this.fear = new Fear(0);
        this.splash = false;
        // Set in_water based on initial y position relative to tank bounds
        const bounds = getTankBounds();
        this.in_water = y >= bounds.min.y;
        this.position.setShouldConstrain(this.in_water);
    }
    static loadSpritesheet() {
        Fish.spritesheet = loadImage('assets/tetra_small_clear.png');
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
    calculateNetForce(fish_in_view, fish_by_lateral_line) {
        let totalForce = Vector.zero();
        // Handle fish in visual range
        for (let other of fish_in_view) {
            if (other.constructor.name === 'UserFish') {
                // weak attraction to user fish
                totalForce.addInPlace(this.calculateAttractionForce(other, 0.02, 0.0005));
            }
            else {
                const distance = this.distanceTo(other);
                if (distance > 150) {
                    // Weak attraction to other fish when far
                    totalForce.addInPlace(this.calculateAttractionForce(other, 0.02, 0.0005));
                }
                else if (distance < 150) {
                    // Strong repulsion from other fish when close
                    totalForce.addInPlace(this.calculateRepulsionForce(other, 0.1, 0.1));
                }
            }
        }
        // Handle fish detected by lateral line or splash
        for (let other of fish_by_lateral_line) {
            if (other.constructor.name === 'Fish') { // Only react to regular Fish
                // Strong repulsion from fish detected by lateral line or splash
                totalForce.addInPlace(this.calculateRepulsionForce(other, 0.5, 1));
                // If we detect a splash, set fear to maximum and point towards the splashing fish
                if (other instanceof Fish && other.splash) {
                    const direction = other.position.value.subtract(this.position.value);
                    this.fear.increase(1, direction);
                }
            }
        }
        if (fish_in_view.length === 0 && Math.random() < 0.25) {
            // 2% chance to add random movement when no fish in view
            totalForce.addInPlace(Vector.random(-0.01, 0.01));
        }
        return totalForce;
    }
    update(inhabitants) {
        if (!this.in_water) {
            // Apply constant downward acceleration
            this.position.delta.y += 0.4; // Add to velocity directly
            // Check if fish has reached the water surface using tank bounds
            const bounds = getTankBounds();
            if (this.position.y >= bounds.min.y) {
                this.in_water = true;
                this.position.setShouldConstrain(true); // Enable constraints when entering water
                this.position.delta.y *= 0.5; // slow down when entering water
                this.splash = true; // Set splash to true when entering water
            }
            super.update(inhabitants);
            return;
        }
        // Update fear
        this.fear.update();
        // React to other fish within the field of view
        const fish_in_view = [];
        const fish_by_lateral_line = [];
        for (let other of inhabitants) {
            if (other !== this) {
                if (this.isInFieldOfView(other, 45, 200)) {
                    fish_in_view.push(other);
                }
                else if (this.distanceTo(other) <= 50 || (other instanceof Fish && other.splash)) { // Check lateral line or splash
                    fish_by_lateral_line.push(other);
                }
            }
        }
        // Calculate net force
        const netForce = this.calculateNetForce(fish_in_view, fish_by_lateral_line);
        const forceMagnitude = netForce.magnitude();
        // Update initiative based on force magnitude
        this.initiative.delta = forceMagnitude * 2.5; // Scale force to initiative gain
        this.initiative.update();
        // Check if fish should move based on initiative
        if (Math.random() < this.initiative.value) {
            // Normalize the force vector for direction
            const direction = netForce.divide(forceMagnitude || 1);
            // Calculate movement magnitude with some variance
            const baseMagnitude = this.initiative.value;
            const variance = 0.2; // 20% variance
            const magnitude = baseMagnitude * (1 + (Math.random() - 0.5) * variance);
            // Apply the movement
            this.position.applyAcceleration(direction.multiply(magnitude), 1);
            // Reduce initiative after movement
            this.initiative.value *= 0.20;
        }
        // Reset splash flag after one frame
        this.splash = false;
        super.update(inhabitants);
    }
    getVerticalTilt() {
        const delta = this.position.delta;
        if (delta.x === 0)
            return 0;
        // Calculate angle between horizontal movement and vertical movement
        // adding 2 so that tilt is minimal when facing forward or back
        const angle = Math.atan2(delta.y, Math.abs(delta.x) + 2);
        // Negate the angle if moving left (negative x)
        return delta.x < 0 ? -angle : angle;
    }
    getSpriteIndex() {
        const delta = this.position.delta;
        const x = delta.x;
        const z = delta.z;
        // Calculate angle in radians
        const angle = Math.atan2(z, x);
        // Convert to degrees and normalize to 0-360
        const degrees = (angle * 180 / Math.PI + 180) % 360;
        // Map to octants
        if (degrees >= 337.5 || degrees < 22.5)
            return { index: 2, mirrored: false }; // left
        if (degrees >= 22.5 && degrees < 67.5)
            return { index: 1, mirrored: false }; // front-left
        if (degrees >= 67.5 && degrees < 112.5)
            return { index: 0, mirrored: false }; // front
        if (degrees >= 112.5 && degrees < 157.5)
            return { index: 1, mirrored: true }; // front-right
        if (degrees >= 157.5 && degrees < 202.5)
            return { index: 2, mirrored: true }; // right
        if (degrees >= 202.5 && degrees < 247.5)
            return { index: 3, mirrored: true }; // back-right
        if (degrees >= 247.5 && degrees < 292.5)
            return { index: 4, mirrored: false }; // back
        return { index: 3, mirrored: false }; // back-left
    }
    render(tank, color) {
        if (!Fish.spritesheet)
            return;
        // Use the same positioning logic as the Inhabitant class
        const relativeDepth = this.position.z / tank.depth;
        const renderX = lerp(tank.x, tank.backX, relativeDepth) + (this.position.x - tank.x) * lerp(1, 0.7, relativeDepth);
        const renderY = lerp(tank.y, tank.backY, relativeDepth) + (this.position.y - tank.y) * lerp(1, 0.7, relativeDepth);
        // Scale size based on depth
        const depthScale = lerp(1, 0.7, relativeDepth);
        const { index, mirrored } = this.getSpriteIndex();
        const spriteConfig = Fish.SPRITE_CONFIGS[index];
        // Use height as the consistent scaling factor
        const MAX_SPRITE_HEIGHT = 41; // Height of the tallest sprite
        // Calculate scale based on the fish's size and the max sprite height
        const scale_size = (this.size * depthScale) / MAX_SPRITE_HEIGHT;
        const spriteWidth = spriteConfig.width * scale_size;
        const spriteHeight = spriteConfig.height * scale_size;
        // Get the tilt angle
        const tilt = this.getVerticalTilt();
        // Save current transformation state and start with a clean slate
        push();
        // Apply transformations in this specific order:
        translate(renderX, renderY); // 1. Move to position
        rotate(tilt); // 2. Apply rotation
        // 3. Apply mirroring if needed
        if (mirrored) {
            scale(-1, 1);
        }
        // Draw the sprite centered at origin (which is now at the fish's position)
        image(Fish.spritesheet, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight, spriteConfig.x, spriteConfig.y, spriteConfig.width, spriteConfig.height);
        // Restore the original transformation state
        pop();
    }
}
Fish.spritesheet = null;
Fish.SPRITE_CONFIGS = [
    { x: 3, y: 54, width: 34, height: 41 }, // front
    { x: 129, y: 54, width: 48, height: 41 }, // front-left
    { x: 76, y: 54, width: 50, height: 41 }, // left
    { x: 182, y: 54, width: 32, height: 40 }, // back-left
    { x: 44, y: 54, width: 26, height: 41 } // back
];
