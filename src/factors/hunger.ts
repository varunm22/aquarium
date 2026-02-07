import { Factor } from './factor.js';
import { Inhabitant } from '../inhabitants/inhabitant.js';
import { Food } from '../inhabitants/food.js';
import { Vector } from '../vector.js';

export class Hunger extends Factor<number> {
    public increaseRate: number;
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
        this.value = Math.min(1, this.value + this.increaseRate);
        this.value = Math.max(0, Math.min(this.value, 1));

        if (this.isEating > 0) this.isEating--;

        if (this.smelledFoodDirection) {
            this.smelledFoodDirection.multiplyInPlace(0.98);
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

    startEating(): void { this.isEating = 10; }
    setFeeding(feeding: boolean): void { this.feeding = feeding; }
    isFeeding(): boolean { return this.feeding; }
    setSmelledFoodDirection(direction: Vector | null): void { this.smelledFoodDirection = direction; }
    getSmelledFoodDirection(): Vector | null { return this.smelledFoodDirection; }

    updateFeedingMode(food_in_view: (Inhabitant | Food)[], hasSmellOfFood: boolean): void {
        const currentHunger = this.value;
        const hasFoodInSight = food_in_view.length > 0;
        const hasFoodPresence = hasFoodInSight || hasSmellOfFood;
        
        if (!this.feeding) {
            let probability = 0;
            if (hasFoodPresence) {
                if (currentHunger > 0.1) {
                    probability = currentHunger / 10;
                    if (hasFoodInSight) probability *= 1.2;
                }
            } else if (currentHunger > 0.5) {
                probability = currentHunger / 200;
            }
            if (Math.random() < probability) this.feeding = true;
        } else {
            // Leave feeding mode when no food detected, with probability inversely proportional to hunger
            if (!hasFoodPresence) {
                if (Math.random() < (1 - currentHunger) / 100) {
                    this.feeding = false;
                }
            }
        }
    }

    exitFeedingDueToFear(): void {
        this.feeding = false;
        this.smelledFoodDirection = null;
    }

    setTarget(target: Inhabitant | Food | null): void {
        this.target = target;
    }
}
