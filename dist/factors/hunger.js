import { Factor } from './factor.js';
export class Hunger extends Factor {
    constructor(value = 0, delta = 0) {
        super(value, delta);
        this.increaseRate = 0;
        this.inStrike = false;
        this.target = null;
        this.isEating = 0;
    }
    update() {
        super.update();
        // Randomly increase hunger at a slow rate
        this.increaseRate = Math.random() * 0.001;
        this.value = Math.min(1, this.value + this.increaseRate);
        // Constrain hunger to reasonable bounds
        this.value = Math.max(0, Math.min(this.value, 1));
        // Decrease isEating counter if active
        if (this.isEating > 0) {
            this.isEating--;
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
        this.isEating = 30;
    }
    setTarget(target) {
        this.target = target;
    }
}
