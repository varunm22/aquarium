import { Factor } from './factor.js';
import { Inhabitant } from '../inhabitants/inhabitant.js';
import { Food } from '../inhabitants/food.js';

export class Hunger extends Factor<number> {
    private increaseRate: number;
    public inStrike: boolean;
    public target: Inhabitant | Food | null;
    public isEating: number;
    public feeding: boolean;

    constructor(value: number = 0, delta: number = 0) {
        super(value, delta);
        this.increaseRate = 0;
        this.inStrike = false;
        this.target = null;
        this.isEating = 0;
        this.feeding = false;
    }

    update(): void {
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

    updateFeedingMode(food_in_view: (Inhabitant | Food)[]): void {
        const currentHunger = this.value;
        const hasFoodInSight = food_in_view.length > 0;
        
        if (!this.feeding) {
            // Not currently in feeding mode - check if we should enter
            let probability = 0;
            
            if (hasFoodInSight) {
                // If food in sight: enter feeding mode with probability = current hunger (only if hunger > 0.1)
                if (currentHunger > 0.1) {
                    probability = currentHunger / 10;
                }
            } else {
                // If no food in sight: enter feeding mode with probability = current hunger / 100 (only if hunger > 0.5)
                if (currentHunger > 0.5) {
                    probability = currentHunger / 200;
                }
            }
            
            if (Math.random() < probability) {
                this.feeding = true;
            }
        } else {
            // Currently in feeding mode - check if we should leave
            if (!hasFoodInSight) {
                // If no food in sight: leave feeding mode with probability = (1-hunger)/100
                const probability = (1 - currentHunger) / 100;
                if (Math.random() < probability) {
                    this.feeding = false;
                }
            }
            // If food in sight, stay in feeding mode
        }
    }

    exitFeedingDueToFear(): void {
        this.feeding = false;
    }

    setTarget(target: Inhabitant | Food | null): void {
        this.target = target;
    }
} 