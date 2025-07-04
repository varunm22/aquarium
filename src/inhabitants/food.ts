import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
import { Tank } from '../tank.js';
import { getTankBounds } from '../constants.js';

// Declare p5.js global functions
declare function fill(r: number, g: number, b: number): void;
declare function noStroke(): void;
declare function ellipse(x: number, y: number, w: number, h: number): void;
declare function lerp(start: number, stop: number, amt: number): number;

export class Food {
    position: Position;
    size: number;
    inWater: boolean;
    floating: boolean; // New property for floating behavior
    settled: boolean; // Property to track if food has settled at bottom
    tank: Tank | null = null;

    constructor(x: number, y: number, z: number) {
        // Start above the water with no initial velocity
        this.position = new Position(new Vector(x, y, z), new Vector(0, 0, 0), false); // false = no constraints initially
        this.size = 3;
        this.inWater = false;
        this.floating = false; // Start not floating
        this.settled = false; // Start unsettled
    }

    setTank(tank: Tank): void {
        this.tank = tank;
    }

    update(): void {
        // Don't update if food has settled at the bottom
        if (this.settled) {
            return;
        }

        if (!this.inWater) {
            // Apply constant downward acceleration when not in water
            this.position.delta.y += 0.4; // Same as fish falling

            // Check if food has reached the water surface
            const bounds = getTankBounds();
            if (this.position.y >= bounds.min.y) {
                this.inWater = true;
                this.floating = true; // Start floating when hitting water
                this.position.setShouldConstrain(true); // Enable constraints when entering water
                
                // Stop all movement when starting to float
                this.position.delta = Vector.zero();
                this.position.ddelta = Vector.zero();
            }
        } else if (this.floating) {
            // While floating, 1% chance per frame to start sinking
            if (Math.random() < 0.004) {
                this.floating = false;
            }
            // Don't apply any downward acceleration while floating
        } else {
            // In water and not floating - continue sinking with reduced gravity
            this.position.delta.y += 0.02;
            
            // Add small random drift occasionally
            if (Math.random() < 0.25) { // 25% chance each frame
                const drift = Vector.random(-0.1, 0.1);
                this.position.applyAcceleration(drift, 2);
            }
        }

        // Update position (only if not floating, since floating food should stay put)
        if (!this.floating) {
            this.position.update();
        }

        // Check if food has reached the bottom and should settle
        if (!this.floating && this.isAtBottom()) {
            this.settled = true;
            // Stop all movement
            this.position.delta = Vector.zero();
            this.position.ddelta = Vector.zero();
        }
    }

    render(tank: Tank): void {
        // Use the same rendering approach as inhabitants
        const relativeDepth = this.position.z / tank.depth;
        const renderX = lerp(tank.x, tank.backX, relativeDepth) + (this.position.x - tank.x) * lerp(1, 0.7, relativeDepth);
        const renderY = lerp(tank.y, tank.backY, relativeDepth) + (this.position.y - tank.y) * lerp(1, 0.7, relativeDepth);

        // Scale size based on depth
        const renderSize = this.size * lerp(1, 0.7, relativeDepth);

        // Render as a brown circle
        fill(139, 69, 19); // Brown color
        noStroke();
        ellipse(renderX, renderY, renderSize, renderSize);
    }

    // Check if food has reached the bottom
    isAtBottom(): boolean {
        const bounds = getTankBounds();
        return this.position.y >= bounds.max.y - 2; // Within 2 units of the bottom
    }
} 