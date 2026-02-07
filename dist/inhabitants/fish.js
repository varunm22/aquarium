import { Inhabitant } from './inhabitant.js';
import { Initiative } from '../factors/initiative.js';
import { Fear } from '../factors/fear.js';
import { Hunger } from '../factors/hunger.js';
import { getTankBounds } from '../constants.js';
import * as behavior from './behavior.js';
export class Fish extends Inhabitant {
    constructor(position, size) {
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
    static loadSpritesheet() {
        Fish.spritesheet = loadImage('assets/tetra_small_clear.png');
    }
    updateFear() { this.fear.update(); }
    updateHunger() { this.hunger.update(); }
    updateInitiative(delta) {
        this.initiative.delta = delta;
        this.initiative.update();
    }
    getInitiativeValue() { return this.initiative.value; }
    setInitiativeValue(value) { this.initiative.value = value; }
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
    getFearDirection() { return this.fear.getDirection(); }
    getFearValue() { return this.fear.value; }
    increaseFear(amount, direction) { this.fear.increase(amount, direction); }
    getHungerValue() { return this.hunger.value; }
    isInStrike() { return this.hunger.inStrike; }
    getStrikeTarget() { return this.hunger.target; }
    startStrike(target) { this.hunger.startStrike(target); }
    endStrike() { this.hunger.endStrike(); }
    isEating() { return this.hunger.isEating > 0; }
    startEating() { this.hunger.startEating(); }
    setHungerTarget(target) { this.hunger.setTarget(target); }
    decreaseHunger(amount) { this.hunger.value = Math.max(0, this.hunger.value - amount); }
    isInFeedingMode() { return this.hunger.isFeeding(); }
    setFeedingMode(feeding) { this.hunger.setFeeding(feeding); }
    getSmelledFoodDirection() { return this.hunger.getSmelledFoodDirection(); }
    setSmelledFoodDirection(direction) { this.hunger.setSmelledFoodDirection(direction); }
    update(inhabitants) {
        if (this.splash > 0)
            this.splash--;
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
        }
        else {
            const hasSmellOfFood = smelled_food_direction !== null;
            this.hunger.updateFeedingMode([...microfauna_in_view, ...food_in_view], hasSmellOfFood);
            if (this.isInFeedingMode()) {
                behavior.handleHungerMovement(this, microfauna_in_view, food_in_view);
            }
            else {
                behavior.handleNormalMovement(this, fish_in_view, fish_by_lateral_line);
            }
        }
        super.update(inhabitants);
    }
    getTank(inhabitants) {
        for (const inhabitant of inhabitants) {
            if ('tank' in inhabitant && inhabitant.tank) {
                return inhabitant.tank;
            }
        }
        return null;
    }
    getVerticalTilt() {
        const delta = this.position.delta;
        if (delta.x === 0)
            return 0;
        // Add 2 to denominator so tilt is minimal when facing forward or back
        const angle = Math.atan2(delta.y, Math.abs(delta.x) + 2);
        return delta.x < 0 ? -angle : angle;
    }
    getSpriteIndex() {
        const delta = this.position.delta;
        const angle = Math.atan2(delta.z, delta.x);
        const degrees = (angle * 180 / Math.PI + 180) % 360;
        if (degrees >= 337.5 || degrees < 22.5)
            return { index: 2, mirrored: false };
        if (degrees >= 22.5 && degrees < 67.5)
            return { index: 1, mirrored: false };
        if (degrees >= 67.5 && degrees < 112.5)
            return { index: 0, mirrored: false };
        if (degrees >= 112.5 && degrees < 157.5)
            return { index: 1, mirrored: true };
        if (degrees >= 157.5 && degrees < 202.5)
            return { index: 2, mirrored: true };
        if (degrees >= 202.5 && degrees < 247.5)
            return { index: 3, mirrored: true };
        if (degrees >= 247.5 && degrees < 292.5)
            return { index: 4, mirrored: false };
        return { index: 3, mirrored: false };
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
