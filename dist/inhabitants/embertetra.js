import { Fish } from './fish.js';
import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
export class EmberTetra extends Fish {
    constructor(x, y, z, size) {
        const position = new Position(new Vector(x, y, z), Vector.random(-1, 1), false);
        super(position, size);
    }
    static loadSpritesheet() {
        EmberTetra.spritesheet = loadImage('assets/tetra_small_clear.png');
    }
    render(tank, color) {
        if (!EmberTetra.spritesheet)
            return;
        // Use the same positioning logic as the Inhabitant class
        const relativeDepth = this.position.z / tank.depth;
        const renderX = lerp(tank.x, tank.backX, relativeDepth) + (this.position.x - tank.x) * lerp(1, 0.7, relativeDepth);
        const renderY = lerp(tank.y, tank.backY, relativeDepth) + (this.position.y - tank.y) * lerp(1, 0.7, relativeDepth);
        // Scale size based on depth
        const depthScale = lerp(1, 0.7, relativeDepth);
        const { index, mirrored } = this.getSpriteIndex();
        const spriteConfig = EmberTetra.SPRITE_CONFIGS[index];
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
        image(EmberTetra.spritesheet, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight, spriteConfig.x, spriteConfig.y, spriteConfig.width, spriteConfig.height);
        // Restore the original transformation state
        pop();
    }
    getSpriteInfo() {
        return this.getSpriteIndex();
    }
}
EmberTetra.spritesheet = null;
EmberTetra.SPRITE_CONFIGS = [
    { x: 3, y: 54, width: 34, height: 41 }, // front
    { x: 129, y: 54, width: 48, height: 41 }, // front-left
    { x: 76, y: 54, width: 50, height: 41 }, // left
    { x: 182, y: 54, width: 32, height: 40 }, // back-left
    { x: 44, y: 54, width: 26, height: 41 } // back
];
