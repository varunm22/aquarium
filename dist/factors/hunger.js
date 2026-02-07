import { Factor } from './factor.js';
export class Hunger extends Factor {
    constructor(value = 0, delta = 0, increaseRate = 0.0003) {
        super(value, delta);
        this.increaseRate = increaseRate;
        this.inStrike = false;
        this.target = null;
        this.isEating = 0;
        this.feeding = false;
        this.smelledFoodDirection = null;
    }
    update() {
        super.update();
        this.value = Math.min(1, this.value + this.increaseRate);
        this.value = Math.max(0, Math.min(this.value, 1));
        if (this.isEating > 0)
            this.isEating--;
        if (this.smelledFoodDirection) {
            this.smelledFoodDirection.multiplyInPlace(0.98);
            if (this.smelledFoodDirection.magnitude() < 0.01) {
                this.smelledFoodDirection = null;
            }
        }
    }
    startStrike(target) {
        this.inStrike = true;
        this.target = target;
    }
    endStrike() {
        this.inStrike = false;
        this.target = null;
    }
    startEating() { this.isEating = 10; }
    setFeeding(feeding) { this.feeding = feeding; }
    isFeeding() { return this.feeding; }
    setSmelledFoodDirection(direction) { this.smelledFoodDirection = direction; }
    getSmelledFoodDirection() { return this.smelledFoodDirection; }
    updateFeedingMode(food_in_view, hasSmellOfFood) {
        const currentHunger = this.value;
        const hasFoodInSight = food_in_view.length > 0;
        const hasFoodPresence = hasFoodInSight || hasSmellOfFood;
        if (!this.feeding) {
            let probability = 0;
            if (hasFoodPresence) {
                if (currentHunger > 0.1) {
                    probability = currentHunger / 10;
                    if (hasFoodInSight)
                        probability *= 1.2;
                }
            }
            else if (currentHunger > 0.5) {
                probability = currentHunger / 200;
            }
            if (Math.random() < probability)
                this.feeding = true;
        }
        else {
            // Leave feeding mode when no food detected, with probability inversely proportional to hunger
            if (!hasFoodPresence) {
                if (Math.random() < (1 - currentHunger) / 100) {
                    this.feeding = false;
                }
            }
        }
    }
    exitFeedingDueToFear() {
        this.feeding = false;
        this.smelledFoodDirection = null;
    }
    setTarget(target) {
        this.target = target;
    }
}
