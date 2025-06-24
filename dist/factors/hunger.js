import { Factor } from './factor.js';
export class Hunger extends Factor {
    constructor(value = 0, delta = 0) {
        super(value, delta);
        this.increaseRate = 0;
        this.inStrike = false;
        this.target = null;
        this.isEating = 0;
        this.feeding = false;
        this.smelledFoodDirection = null;
    }
    update() {
        super.update();
        // Randomly increase hunger at a slow rate
        this.increaseRate = Math.random() * 0.0003;
        this.value = Math.min(1, this.value + this.increaseRate);
        // Constrain hunger to reasonable bounds
        this.value = Math.max(0, Math.min(this.value, 1));
        // Decrease isEating counter if active
        if (this.isEating > 0) {
            this.isEating--;
        }
        // Gradually weaken smelled food direction over time
        if (this.smelledFoodDirection) {
            this.smelledFoodDirection.multiplyInPlace(0.98); // Decay the smell over time
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
    startEating() {
        this.isEating = 10;
    }
    setFeeding(feeding) {
        this.feeding = feeding;
    }
    isFeeding() {
        return this.feeding;
    }
    setSmelledFoodDirection(direction) {
        this.smelledFoodDirection = direction;
    }
    getSmelledFoodDirection() {
        return this.smelledFoodDirection;
    }
    updateFeedingMode(food_in_view, hasSmellOfFood) {
        const currentHunger = this.value;
        const hasFoodInSight = food_in_view.length > 0;
        const hasFoodPresence = hasFoodInSight || hasSmellOfFood;
        if (!this.feeding) {
            // Not currently in feeding mode - check if we should enter
            let probability = 0;
            if (hasFoodPresence) {
                // If food detected (sight or smell): enter feeding mode with probability = current hunger (only if hunger > 0.1)
                if (currentHunger > 0.1) {
                    probability = currentHunger / 10;
                    // Slightly higher probability if we can actually see food vs just smell it
                    if (hasFoodInSight) {
                        probability *= 1.2;
                    }
                }
            }
            else {
                // If no food detected: enter feeding mode with probability = current hunger / 100 (only if hunger > 0.5)
                if (currentHunger > 0.5) {
                    probability = currentHunger / 200;
                }
            }
            if (Math.random() < probability) {
                this.feeding = true;
            }
        }
        else {
            // Currently in feeding mode - check if we should leave
            if (!hasFoodPresence) {
                // If no food detected: leave feeding mode with probability = (1-hunger)/100
                const probability = (1 - currentHunger) / 100;
                if (Math.random() < probability) {
                    this.feeding = false;
                }
            }
            // If food detected (sight or smell), stay in feeding mode
        }
    }
    exitFeedingDueToFear() {
        this.feeding = false;
        this.smelledFoodDirection = null; // Clear smell when scared
    }
    setTarget(target) {
        this.target = target;
    }
}
