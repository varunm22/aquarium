import { Inhabitant } from './inhabitant.js';
import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
import { Tank } from '../tank.js';

export class Microfauna extends Inhabitant {
    public tank: Tank | null = null;
    private static readonly MAX_NEARBY = 20;
    private static readonly MAX_DISTANCE = 100;
    private static readonly BASE_REPRODUCTION_CHANCE = 0.004;
    private static readonly GROWTH_CHANCE = 0.01;
    private static readonly GROWTH_AMOUNT = 0.1;
    private static readonly MAX_SIZE = 3.5;

    constructor(position: Position) {
        super(position, 1);
    }

    setTank(tank: Tank): void { this.tank = tank; }
    getSize(): number { return this.size; }

    private updateSize(): void {
        if (this.size < Microfauna.MAX_SIZE && Math.random() < Microfauna.GROWTH_CHANCE) {
            this.size = Math.min(this.size + Microfauna.GROWTH_AMOUNT, Microfauna.MAX_SIZE);
        }
    }

    private getNearbyMicrofaunaCount(inhabitants: Inhabitant[]): number {
        return inhabitants.filter(other => 
            other !== this && 
            other instanceof Microfauna && 
            this.distanceTo(other) <= Microfauna.MAX_DISTANCE
        ).length;
    }

    // Inverse linear scaling: chance decreases as nearby count increases
    private calculateReproductionChance(nearbyCount: number): number {
        if (nearbyCount >= Microfauna.MAX_NEARBY) return 0;
        return Microfauna.BASE_REPRODUCTION_CHANCE / (1 + nearbyCount);
    }

    update(_inhabitants: Inhabitant[] = []): void {
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
                const newPosition = new Position(
                    new Vector(this.position.x, this.position.y, this.position.z),
                    new Vector(0, 0, 0)
                );
                const newMicrofauna = new Microfauna(newPosition);
                newMicrofauna.setTank(this.tank);
                this.tank.addMicrofauna(newMicrofauna);
            }
        }
        
        super.update(_inhabitants);
    }
}
