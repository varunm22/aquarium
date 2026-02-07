import { Inhabitant } from './inhabitant.js';
import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
import { Snail } from './snail_new.js';
import { TANK_CONSTANTS } from '../constants.js';
export class EggClump extends Inhabitant {
    constructor(position, wall) {
        super(new Position(position, new Vector(0, 0, 0), false), 15); // Size 15 for egg clump
        this.HATCH_TIME = 600; // 600 frames (10 seconds at 60fps)
        this.BABY_COUNT = 7; // Average number of baby snails
        this.tank = null;
        this.opacity = 180; // Semi-transparent grey
        this.wall = wall;
        this.hatchTimer = this.HATCH_TIME;
    }
    setTank(tank) {
        this.tank = tank;
    }
    update(_inhabitants) {
        this.hatchTimer--;
        if (this.hatchTimer <= 0) {
            this.hatch();
        }
    }
    hatch() {
        if (!this.tank)
            return;
        // Generate random number of baby snails (5-10)
        const babyCount = Math.floor(random() * 6) + 5; // 5-10 babies
        // Spawn baby snails with small offsets in the 2D plane of the wall
        for (let i = 0; i < babyCount; i++) {
            const offset = this.generateBabyOffset();
            const babyPosition = this.position.value.copy().addInPlace(offset);
            // Clamp position to wall bounds
            const clampedPosition = this.clampPositionToWall(babyPosition);
            const babySnail = new Snail(3, clampedPosition, this.wall, 0.5); // Start at size 3 with 50% hunger
            babySnail.setTank(this.tank);
            // Set a random initial goal so babies scatter in different directions
            babySnail.setRandomGoal();
            this.tank.addSnail(babySnail);
        }
        // Mark this egg clump for removal
        this.markForRemoval();
    }
    generateBabyOffset() {
        // Generate random offset within a small radius (20 units) in the 2D plane of the wall
        const maxOffset = 20;
        const angle = random() * Math.PI * 2; // Random angle
        const distance = random() * maxOffset; // Random distance within max offset
        switch (this.wall) {
            case 'front':
            case 'back':
                // Offset in X-Y plane
                return new Vector(Math.cos(angle) * distance, Math.sin(angle) * distance, 0);
            case 'left':
            case 'right':
                // Offset in Y-Z plane
                return new Vector(0, Math.cos(angle) * distance, Math.sin(angle) * distance);
            case 'bottom':
                // Offset in X-Z plane
                return new Vector(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
            default:
                return Vector.zero();
        }
    }
    clampPositionToWall(pos) {
        const bounds = EggClump.getTankBounds();
        const clampedPos = pos.copy();
        // Clamp to tank bounds first
        clampedPos.x = Math.max(bounds.minX, Math.min(bounds.maxX, clampedPos.x));
        clampedPos.y = Math.max(bounds.minY, Math.min(bounds.maxY, clampedPos.y));
        clampedPos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, clampedPos.z));
        // Then clamp to current wall
        const wallOffset = this.size / 2;
        switch (this.wall) {
            case 'front':
                clampedPos.z = bounds.minZ + wallOffset;
                break;
            case 'back':
                clampedPos.z = bounds.maxZ - wallOffset;
                break;
            case 'left':
                clampedPos.x = bounds.minX + wallOffset;
                break;
            case 'right':
                clampedPos.x = bounds.maxX - wallOffset;
                break;
            case 'bottom':
                clampedPos.y = bounds.maxY - wallOffset;
                break;
        }
        return clampedPos;
    }
    static getTankBounds() {
        return {
            minX: TANK_CONSTANTS.X,
            maxX: TANK_CONSTANTS.X + TANK_CONSTANTS.WIDTH,
            minY: TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT,
            maxY: TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT - TANK_CONSTANTS.GRAVEL_HEIGHT,
            minZ: TANK_CONSTANTS.MIN_Z,
            maxZ: TANK_CONSTANTS.DEPTH
        };
    }
    markForRemoval() {
        // This will be handled by the tank's update method
        // We'll add a flag to indicate the egg clump should be removed
        this.hatchTimer = -1; // Mark as ready for removal
    }
    // Public method to check if egg clump should be removed
    shouldBeRemoved() {
        return this.hatchTimer < 0;
    }
    // Public method to get hatch progress (0-1)
    getHatchProgress() {
        return Math.max(0, 1 - (this.hatchTimer / this.HATCH_TIME));
    }
    render(tank, _color) {
        const relativeDepth = this.position.z / tank.depth;
        const renderX = lerp(tank.x, tank.backX, relativeDepth) + (this.position.x - tank.x) * lerp(1, 0.7, relativeDepth);
        const renderY = lerp(tank.y, tank.backY, relativeDepth) + (this.position.y - tank.y) * lerp(1, 0.7, relativeDepth);
        // Scale size based on depth
        const depthScale = lerp(1, 0.7, relativeDepth);
        const renderSize = this.size * depthScale;
        push();
        // Semi-transparent grey circle
        fill(128, 128, 128, this.opacity);
        noStroke();
        ellipse(renderX, renderY, renderSize, renderSize);
        // Optional: Add a subtle pulsing effect as it gets closer to hatching
        const hatchProgress = this.getHatchProgress();
        if (hatchProgress > 0.8) {
            // Pulsing effect in the last 20% of hatch time
            const pulseIntensity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
            fill(128, 128, 128, this.opacity * pulseIntensity);
            ellipse(renderX, renderY, renderSize * 1.2, renderSize * 1.2);
        }
        pop();
    }
}
