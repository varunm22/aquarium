import { Inhabitant } from './inhabitant.js';
import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
import { Tank } from '../tank.js';
import { Snail } from './snail_new.js';
import { TANK_CONSTANTS, getTankBounds } from '../constants.js';

// Declare p5.js global functions
declare function lerp(start: number, stop: number, amt: number): number;
declare function push(): void;
declare function pop(): void;
declare function fill(r: number, g: number, b: number, a?: number): void;
declare function noStroke(): void;
declare function ellipse(x: number, y: number, w: number, h: number): void;
declare function random(): number;

// Declare p5.Color type
declare namespace p5 {
  interface Color {}
}

type Wall = 'front' | 'back' | 'left' | 'right' | 'bottom';

export class EggClump extends Inhabitant {
    private wall: Wall;
    private hatchTimer: number;
    private readonly HATCH_TIME: number = 600; // 600 frames (10 seconds at 60fps)
    private readonly BABY_COUNT: number = 7; // Average number of baby snails
    private tank: Tank | null = null;
    private opacity: number = 180; // Semi-transparent grey

    constructor(position: Vector, wall: Wall) {
        super(new Position(position, new Vector(0, 0, 0), false), 15); // Size 15 for egg clump
        this.wall = wall;
        this.hatchTimer = this.HATCH_TIME;
    }

    setTank(tank: Tank): void {
        this.tank = tank;
    }

    update(_inhabitants: Inhabitant[]): void {
        this.hatchTimer--;
        
        if (this.hatchTimer <= 0) {
            this.hatch();
        }
    }

    private hatch(): void {
        if (!this.tank) return;

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

    private generateBabyOffset(): Vector {
        // Generate random offset within a small radius (20 units) in the 2D plane of the wall
        const maxOffset = 20;
        const angle = random() * Math.PI * 2; // Random angle
        const distance = random() * maxOffset; // Random distance within max offset
        
        switch (this.wall) {
            case 'front':
            case 'back':
                // Offset in X-Y plane
                return new Vector(
                    Math.cos(angle) * distance,
                    Math.sin(angle) * distance,
                    0
                );
            case 'left':
            case 'right':
                // Offset in Y-Z plane
                return new Vector(
                    0,
                    Math.cos(angle) * distance,
                    Math.sin(angle) * distance
                );
            case 'bottom':
                // Offset in X-Z plane
                return new Vector(
                    Math.cos(angle) * distance,
                    0,
                    Math.sin(angle) * distance
                );
            default:
                return Vector.zero();
        }
    }

    private clampPositionToWall(pos: Vector): Vector {
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

    private static getTankBounds() {
        return {
            minX: TANK_CONSTANTS.X,
            maxX: TANK_CONSTANTS.X + TANK_CONSTANTS.WIDTH,
            minY: TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT,
            maxY: TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT - TANK_CONSTANTS.GRAVEL_HEIGHT,
            minZ: TANK_CONSTANTS.MIN_Z,
            maxZ: TANK_CONSTANTS.DEPTH
        };
    }

    private markForRemoval(): void {
        // This will be handled by the tank's update method
        // We'll add a flag to indicate the egg clump should be removed
        this.hatchTimer = -1; // Mark as ready for removal
    }

    // Public method to check if egg clump should be removed
    public shouldBeRemoved(): boolean {
        return this.hatchTimer < 0;
    }

    // Public method to get hatch progress (0-1)
    public getHatchProgress(): number {
        return Math.max(0, 1 - (this.hatchTimer / this.HATCH_TIME));
    }

    render(tank: Tank, _color?: p5.Color): void {
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
