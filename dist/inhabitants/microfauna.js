import { Inhabitant } from './inhabitant.js';
import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
export class Microfauna extends Inhabitant {
    constructor(position) {
        super(position, 1);
        this.tank = null;
    }
    setTank(tank) { this.tank = tank; }
    getSize() { return this.size; }
    updateSize() {
        if (this.size < Microfauna.MAX_SIZE && Math.random() < Microfauna.GROWTH_CHANCE) {
            this.size = Math.min(this.size + Microfauna.GROWTH_AMOUNT, Microfauna.MAX_SIZE);
        }
    }
    getNearbyMicrofaunaCount(inhabitants) {
        return inhabitants.filter(other => other !== this &&
            other instanceof Microfauna &&
            this.distanceTo(other) <= Microfauna.MAX_DISTANCE).length;
    }
    // Inverse linear scaling: chance decreases as nearby count increases
    calculateReproductionChance(nearbyCount) {
        if (nearbyCount >= Microfauna.MAX_NEARBY)
            return 0;
        return Microfauna.BASE_REPRODUCTION_CHANCE / (1 + nearbyCount);
    }
    update(_inhabitants = []) {
        this.updateSize();
        if (Math.random() < 0.1) {
            const distanceFromBottom = this.tank ?
                (this.tank.waterLevelBottom - this.position.y) / this.tank.height : 0;
            const randomDelta = Vector.random(-0.1, 0.1);
            randomDelta.y += distanceFromBottom * 0.05;
            this.position.applyAcceleration(randomDelta, 1);
        }
        if (this.tank) {
            const nearbyCount = this.getNearbyMicrofaunaCount(_inhabitants);
            const reproductionChance = this.calculateReproductionChance(nearbyCount);
            if (Math.random() < reproductionChance) {
                const newPosition = new Position(new Vector(this.position.x, this.position.y, this.position.z), new Vector(0, 0, 0));
                const newMicrofauna = new Microfauna(newPosition);
                newMicrofauna.setTank(this.tank);
                this.tank.addMicrofauna(newMicrofauna);
            }
        }
        super.update(_inhabitants);
    }
}
Microfauna.MAX_NEARBY = 20;
Microfauna.MAX_DISTANCE = 100;
Microfauna.BASE_REPRODUCTION_CHANCE = 0.004;
Microfauna.GROWTH_CHANCE = 0.01;
Microfauna.GROWTH_AMOUNT = 0.1;
Microfauna.MAX_SIZE = 3.5;
