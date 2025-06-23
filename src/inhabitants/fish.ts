import { Inhabitant } from './inhabitant.js';
import { Vector } from '../vector.js';
import { Tank } from '../tank.js';
import { Position } from '../factors/position.js';
import { Initiative } from '../factors/initiative.js';
import { Fear } from '../factors/fear.js';
import { Hunger } from '../factors/hunger.js';
import { getTankBounds } from '../constants.js';
import * as behavior from './behavior.js';
import { Food } from './food.js';

// Declare p5.js global functions
declare function loadImage(path: string): p5.Image;

// Declare p5.Color type
declare namespace p5 {
  interface Color {}
  interface Image {}
}

interface SpriteConfig {
  x: number;  // x offset in spritesheet
  y: number;  // y offset in spritesheet
  width: number;  // width of sprite
  height: number;  // height of sprite
}

export abstract class Fish extends Inhabitant {
    static spritesheet: p5.Image | null = null;
    static readonly SPRITE_CONFIGS: SpriteConfig[] = [
        { x: 3, y: 54, width: 34, height: 41 },  // front
        { x: 129, y: 54, width: 48, height: 41 }, // front-left
        { x: 76, y: 54, width: 50, height: 41 }, // left
        { x: 182, y: 54, width: 32, height: 40 }, // back-left
        { x: 44, y: 54, width: 26, height: 41 } // back
    ];

    protected initiative: Initiative;
    protected fear: Fear;
    protected hunger: Hunger;
    public in_water: boolean;
    public splash: number;
    public readonly id: string;

    constructor(position: Position, size: number) {
        super(position, size);
        this.initiative = new Initiative(0);
        this.fear = new Fear(0);
        this.hunger = new Hunger(0.4);
        this.splash = 0;
        this.id = Math.random().toString(36).substring(2, 8); // Generate a random 6-character alphanumeric ID
        
        // Set in_water based on initial y position relative to tank bounds
        const bounds = getTankBounds();
        this.in_water = position.y >= bounds.min.y;
        this.position.setShouldConstrain(this.in_water);
    }

    static loadSpritesheet(): void {
      Fish.spritesheet = loadImage('assets/tetra_small_clear.png');
    }

    // Public methods for behavior functions
    public updateFear(): void {
        this.fear.update();
    }

    public updateHunger(): void {
        this.hunger.update();
    }

    public updateInitiative(delta: number): void {
        this.initiative.delta = delta;
        this.initiative.update();
    }

    public getInitiativeValue(): number {
        return this.initiative.value;
    }

    public setInitiativeValue(value: number): void {
        this.initiative.value = value;
    }

    // Public methods for force calculations
    public calculateAttractionForce(other: Inhabitant, maxSpeed: number, multiplier: number): Vector {
        const direction = other.position.value.subtract(this.position.value);
        const distance = direction.magnitude();
        direction.divideInPlace(distance);
        direction.multiplyInPlace(distance * multiplier);
        if (direction.magnitude() > maxSpeed) {
            direction.multiplyInPlace(maxSpeed / direction.magnitude());
        }
        return direction;
    }

    public calculateRepulsionForce(other: Inhabitant, maxSpeed: number, multiplier: number): Vector {
        const direction = other.position.value.subtract(this.position.value);
        const distance = direction.magnitude();
        direction.divideInPlace(distance);
        direction.multiplyInPlace(-multiplier / (distance * distance));
        if (direction.magnitude() > maxSpeed) {
            direction.multiplyInPlace(maxSpeed / direction.magnitude());
        }
        return direction;
    }

    // Public methods for fear
    public getFearDirection(): Vector {
        return this.fear.getDirection();
    }

    public getFearValue(): number {
        return this.fear.value;
    }

    public increaseFear(amount: number, direction?: Vector): void {
        this.fear.increase(amount, direction);
    }

    // Public methods for hunger
    public getHungerValue(): number {
        return this.hunger.value;
    }

    public isInStrike(): boolean {
        return this.hunger.inStrike;
    }

    public getStrikeTarget(): Inhabitant | Food | null {
        return this.hunger.target;
    }

    public startStrike(target: Inhabitant | Food): void {
        this.hunger.startStrike(target);
    }

    public endStrike(): void {
        this.hunger.endStrike();
    }

    public isEating(): boolean {
        return this.hunger.isEating > 0;
    }

    public startEating(): void {
        this.hunger.startEating();
    }

    public setHungerTarget(target: Inhabitant | Food | null): void {
        this.hunger.setTarget(target);
    }

    public decreaseHunger(amount: number): void {
        this.hunger.value = Math.max(0, this.hunger.value - amount);
    }

    public isInFeedingMode(): boolean {
        return this.hunger.isFeeding();
    }

    public setFeedingMode(feeding: boolean): void {
        this.hunger.setFeeding(feeding);
    }

    update(inhabitants: Inhabitant[]): void {
        // Decrement splash counter if active
        if (this.splash > 0) {
            this.splash--;
        }

        if (!this.in_water) {
            if (!behavior.handleNotInWater(this)) {
                super.update(inhabitants);
                return;
            }
        }

        // Get tank reference for food particles
        const tank = this.getTank(inhabitants);

        // Scan environment first to get fish_by_lateral_line and food
        const { fish_in_view, fish_by_lateral_line, microfauna_in_view, food_in_view } = behavior.scanEnvironment(this, inhabitants, tank ? tank.food : []);

        // Update factors with fish_by_lateral_line for splash detection
        behavior.updateFactors(this, fish_by_lateral_line);

        // Handle movement based on fear level and feeding mode
        if (this.fear.value > 0.5) {
            // If fear response is activated, leave feeding mode
            this.hunger.exitFeedingDueToFear();
            behavior.handleFearMovement(this, fish_in_view, fish_by_lateral_line);
        } else {
            // Update feeding mode based on the new logic
            this.hunger.updateFeedingMode([...microfauna_in_view, ...food_in_view]);
            
            if (this.isInFeedingMode()) {
                behavior.handleHungerMovement(this, microfauna_in_view, food_in_view);
            } else {
                behavior.handleNormalMovement(this, fish_in_view, fish_by_lateral_line);
            }
        }

        super.update(inhabitants);
    }

    // Helper method to get tank reference from inhabitants
    private getTank(inhabitants: Inhabitant[]): Tank | null {
        for (const inhabitant of inhabitants) {
            if ('tank' in inhabitant && inhabitant.tank) {
                return inhabitant.tank as Tank;
            }
        }
        return null;
    }

    protected getVerticalTilt(): number {
        const delta = this.position.delta;
        if (delta.x === 0) return 0;
        
        // Calculate angle between horizontal movement and vertical movement
        // adding 2 so that tilt is minimal when facing forward or back
        const angle = Math.atan2(delta.y, Math.abs(delta.x) + 2);
        // Negate the angle if moving left (negative x)
        return delta.x < 0 ? -angle : angle;
    }

    protected getSpriteIndex(): { index: number; mirrored: boolean } {
        const delta = this.position.delta;
        const x = delta.x;
        const z = delta.z;
        
        // Calculate angle in radians
        const angle = Math.atan2(z, x);
        // Convert to degrees and normalize to 0-360
        const degrees = (angle * 180 / Math.PI + 180) % 360;
        
        // Map to octants
        if (degrees >= 337.5 || degrees < 22.5) return { index: 2, mirrored: false }; // left
        if (degrees >= 22.5 && degrees < 67.5) return { index: 1, mirrored: false }; // front-left
        if (degrees >= 67.5 && degrees < 112.5) return { index: 0, mirrored: false }; // front
        if (degrees >= 112.5 && degrees < 157.5) return { index: 1, mirrored: true }; // front-right
        if (degrees >= 157.5 && degrees < 202.5) return { index: 2, mirrored: true }; // right
        if (degrees >= 202.5 && degrees < 247.5) return { index: 3, mirrored: true }; // back-right
        if (degrees >= 247.5 && degrees < 292.5) return { index: 4, mirrored: false }; // back
        return { index: 3, mirrored: false }; // back-left
    }

    abstract render(tank: Tank, color?: p5.Color): void;
}
  