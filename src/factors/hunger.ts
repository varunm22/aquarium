import { Factor } from './factor.js';
import { Inhabitant } from '../inhabitants/inhabitant.js';
import { Food } from '../inhabitants/food.js';
import { Vector } from '../vector.js';

export class Hunger extends Factor<number> {
    private increaseRate: number;
    public inStrike: boolean;
    public target: Inhabitant | Food | null;
    public isEating: number;
    public feeding: boolean;
    public smelledFoodDirection: Vector | null;

    constructor(value: number = 0, delta: number = 0, increaseRate: number = 0.0003) {
        super(value, delta);
        this.increaseRate = increaseRate;
        this.inStrike = false;
        this.target = null;
        this.isEating = 0;
        this.feeding = false;
        this.smelledFoodDirection = null;
    }

    update(): void {
        super.update();
        
        // Increase hunger at the configured rate
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

    startStrike(target: Inhabitant | Food): void {
        this.inStrike = true;
        this.target = target;
    }

    endStrike(): void {
        this.inStrike = false;
        this.target = null;
    }

    startEating(): void {
        this.isEating = 10;
    }

    setFeeding(feeding: boolean): void {
        this.feeding = feeding;
    }

    isFeeding(): boolean {
        return this.feeding;
    }

    setSmelledFoodDirection(direction: Vector | null): void {
        this.smelledFoodDirection = direction;
    }

    getSmelledFoodDirection(): Vector | null {
        return this.smelledFoodDirection;
    }

    updateFeedingMode(food_in_view: (Inhabitant | Food)[], hasSmellOfFood: boolean): void {
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
            } else {
                // If no food detected: enter feeding mode with probability = current hunger / 100 (only if hunger > 0.5)
                if (currentHunger > 0.5) {
                    probability = currentHunger / 200;
                }
            }
            
            if (Math.random() < probability) {
                this.feeding = true;
            }
        } else {
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

    exitFeedingDueToFear(): void {
        this.feeding = false;
        this.smelledFoodDirection = null; // Clear smell when scared
    }

    setTarget(target: Inhabitant | Food | null): void {
        this.target = target;
    }
} 