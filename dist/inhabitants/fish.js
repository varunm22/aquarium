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
        this.hunger = new Hunger(0);
        this.splash = false;
        // Set in_water based on initial y position relative to tank bounds
        const bounds = getTankBounds();
        this.in_water = position.y >= bounds.min.y;
        this.position.setShouldConstrain(this.in_water);
    }
    static loadSpritesheet() {
        Fish.spritesheet = loadImage('assets/tetra_small_clear.png');
    }
    // Public methods for behavior functions
    updateFear() {
        this.fear.update();
    }
    updateHunger() {
        this.hunger.update();
    }
    updateInitiative(delta) {
        this.initiative.delta = delta;
        this.initiative.update();
    }
    getInitiativeValue() {
        return this.initiative.value;
    }
    setInitiativeValue(value) {
        this.initiative.value = value;
    }
    // Public methods for force calculations
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
    // Public methods for fear
    getFearDirection() {
        return this.fear.getDirection();
    }
    getFearValue() {
        return this.fear.value;
    }
    increaseFear(amount, direction) {
        this.fear.increase(amount, direction);
    }
    // Public methods for hunger
    getHungerValue() {
        return this.hunger.value;
    }
    isInStrike() {
        return this.hunger.inStrike;
    }
    getStrikeTarget() {
        return this.hunger.target;
    }
    startStrike(target) {
        this.hunger.startStrike(target);
    }
    endStrike() {
        this.hunger.endStrike();
    }
    isEating() {
        return this.hunger.isEating > 0;
    }
    startEating() {
        this.hunger.startEating();
    }
    decreaseHunger(amount) {
        this.hunger.value = Math.max(0, this.hunger.value - amount);
    }
    update(inhabitants) {
        if (!this.in_water) {
            if (!behavior.handleNotInWater(this)) {
                super.update(inhabitants);
                return;
            }
        }
        // Update factors
        behavior.updateFactors(this);
        // Scan environment
        const { fish_in_view, fish_by_lateral_line, microfauna_in_view } = behavior.scanEnvironment(this, inhabitants);
        // Handle movement based on fear level
        if (this.fear.value > 0.5) {
            behavior.handleFearMovement(this, fish_in_view, fish_by_lateral_line);
        }
        else if (this.hunger.value > 0.1) {
            behavior.handleHungerMovement(this, microfauna_in_view);
        }
        else {
            behavior.handleNormalMovement(this, fish_in_view, fish_by_lateral_line);
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
}
Fish.spritesheet = null;
Fish.SPRITE_CONFIGS = [
    { x: 3, y: 54, width: 34, height: 41 }, // front
    { x: 129, y: 54, width: 48, height: 41 }, // front-left
    { x: 76, y: 54, width: 50, height: 41 }, // left
    { x: 182, y: 54, width: 32, height: 40 }, // back-left
    { x: 44, y: 54, width: 26, height: 41 } // back
];
