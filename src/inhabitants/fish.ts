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

declare function loadImage(path: string): p5.Image;

declare namespace p5 {
  interface Color {}
  interface Image {}
}

interface SpriteConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export abstract class Fish extends Inhabitant {
    static spritesheet: p5.Image | null = null;
    static readonly SPRITE_CONFIGS: SpriteConfig[] = [
        { x: 3, y: 54, width: 34, height: 41 },    // front
        { x: 129, y: 54, width: 48, height: 41 },   // front-left
        { x: 76, y: 54, width: 50, height: 41 },    // left
        { x: 182, y: 54, width: 32, height: 40 },   // back-left
        { x: 44, y: 54, width: 26, height: 41 }     // back
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
        this.hunger = new Hunger(0.5, 0, 0.0003);
        this.splash = 0;
        this.id = Math.random().toString(36).substring(2, 8);
        
        const bounds = getTankBounds();
        this.in_water = position.y >= bounds.min.y;
        this.position.setShouldConstrain(this.in_water);
    }

    static loadSpritesheet(): void {
      Fish.spritesheet = loadImage('assets/tetra_small_clear.png');
    }

    public updateFear(): void { this.fear.update(); }
    public updateHunger(): void { this.hunger.update(); }

    public updateInitiative(delta: number): void {
        this.initiative.delta = delta;
        this.initiative.update();
    }

    public getInitiativeValue(): number { return this.initiative.value; }
    public setInitiativeValue(value: number): void { this.initiative.value = value; }

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

    public getFearDirection(): Vector { return this.fear.getDirection(); }
    public getFearValue(): number { return this.fear.value; }
    public increaseFear(amount: number, direction?: Vector): void { this.fear.increase(amount, direction); }

    public getHungerValue(): number { return this.hunger.value; }
    public isInStrike(): boolean { return this.hunger.inStrike; }
    public getStrikeTarget(): Inhabitant | Food | null { return this.hunger.target; }
    public startStrike(target: Inhabitant | Food): void { this.hunger.startStrike(target); }
    public endStrike(): void { this.hunger.endStrike(); }
    public isEating(): boolean { return this.hunger.isEating > 0; }
    public startEating(): void { this.hunger.startEating(); }
    public setHungerTarget(target: Inhabitant | Food | null): void { this.hunger.setTarget(target); }
    public decreaseHunger(amount: number): void { this.hunger.value = Math.max(0, this.hunger.value - amount); }
    public isInFeedingMode(): boolean { return this.hunger.isFeeding(); }
    public setFeedingMode(feeding: boolean): void { this.hunger.setFeeding(feeding); }
    public getSmelledFoodDirection(): Vector | null { return this.hunger.getSmelledFoodDirection(); }
    public setSmelledFoodDirection(direction: Vector | null): void { this.hunger.setSmelledFoodDirection(direction); }

    public setFearValue(value: number): void { this.fear.value = value; }
    public setHungerValue(value: number): void { this.hunger.value = value; }

    update(inhabitants: Inhabitant[]): void {
        if (this.splash > 0) this.splash--;

        if (!this.in_water) {
            if (!behavior.handleNotInWater(this)) {
                super.update(inhabitants);
                return;
            }
        }

        const tank = this.getTank(inhabitants);
        const { fish_in_view, fish_by_lateral_line, microfauna_in_view, food_in_view, smelled_food_direction } = behavior.scanEnvironment(this, inhabitants, tank ? tank.food : []);

        this.setSmelledFoodDirection(smelled_food_direction);
        behavior.updateFactors(this, fish_by_lateral_line);

        if (this.fear.value > 0.5) {
            this.hunger.exitFeedingDueToFear();
            behavior.handleFearMovement(this, fish_in_view, fish_by_lateral_line);
        } else {
            const hasSmellOfFood = smelled_food_direction !== null;
            this.hunger.updateFeedingMode([...microfauna_in_view, ...food_in_view], hasSmellOfFood);
            
            if (this.isInFeedingMode()) {
                behavior.handleHungerMovement(this, microfauna_in_view, food_in_view);
            } else {
                behavior.handleNormalMovement(this, fish_in_view, fish_by_lateral_line);
            }
        }

        super.update(inhabitants);
    }

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
        // Add 2 to denominator so tilt is minimal when facing forward or back
        const angle = Math.atan2(delta.y, Math.abs(delta.x) + 2);
        return delta.x < 0 ? -angle : angle;
    }

    protected getSpriteIndex(): { index: number; mirrored: boolean } {
        const delta = this.position.delta;
        const angle = Math.atan2(delta.z, delta.x);
        const degrees = (angle * 180 / Math.PI + 180) % 360;
        
        if (degrees >= 337.5 || degrees < 22.5) return { index: 2, mirrored: false };
        if (degrees >= 22.5 && degrees < 67.5) return { index: 1, mirrored: false };
        if (degrees >= 67.5 && degrees < 112.5) return { index: 0, mirrored: false };
        if (degrees >= 112.5 && degrees < 157.5) return { index: 1, mirrored: true };
        if (degrees >= 157.5 && degrees < 202.5) return { index: 2, mirrored: true };
        if (degrees >= 202.5 && degrees < 247.5) return { index: 3, mirrored: true };
        if (degrees >= 247.5 && degrees < 292.5) return { index: 4, mirrored: false };
        return { index: 3, mirrored: false };
    }

    abstract render(tank: Tank, color?: p5.Color): void;
}
