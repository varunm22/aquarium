import { Inhabitant } from './inhabitant.js';
import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
import { Tank } from '../tank.js';

export class Microfauna extends Inhabitant {
    public tank: Tank | null = null;
    private static readonly MAX_NEARBY = 20;
    private static readonly MAX_DISTANCE = 100;
    private static readonly BASE_REPRODUCTION_CHANCE = 0.005;

    constructor(position: Position) {
        super(position, 2);
    }

    setTank(tank: Tank): void {
        this.tank = tank;
    }

    private getNearbyMicrofaunaCount(inhabitants: Inhabitant[]): number {
        return inhabitants.filter(other => 
            other !== this && 
            other instanceof Microfauna && 
            this.distanceTo(other) <= Microfauna.MAX_DISTANCE
        ).length;
    }

    private calculateReproductionChance(nearbyCount: number): number {
        if (nearbyCount >= Microfauna.MAX_NEARBY) return 0;
        
        // Inverse linear scaling: 1/x relationship
        // When nearbyCount = 0: chance = BASE_REPRODUCTION_CHANCE
        // When nearbyCount = MAX_NEARBY: chance = 0
        // The drop-off is steeper at lower counts
        return Microfauna.BASE_REPRODUCTION_CHANCE / (1 + nearbyCount);
    }

    update(inhabitants: Inhabitant[] = []): void {
        // 10% chance of random movement each frame
        if (Math.random() < 0.1) {
            // Calculate distance from bottom (0 to 1, where 1 is at bottom)
            const distanceFromBottom = this.tank ? 
                (this.tank.waterLevelBottom - this.position.y) / this.tank.height : 0;
            
            // Create random vector with components between -0.1 and 0.1
            const randomDelta = Vector.random(-0.1, 0.1);
            
            const downwardBias = distanceFromBottom * 0.05;
            randomDelta.y += downwardBias;
            
            this.position.applyAcceleration(randomDelta, 1);
        }

        // Check for reproduction based on nearby microfauna
        if (this.tank) {
            const nearbyCount = this.getNearbyMicrofaunaCount(inhabitants);
            const reproductionChance = this.calculateReproductionChance(nearbyCount);
            
            if (Math.random() < reproductionChance) {
                // Create new microfauna at the same position
                const newPosition = new Position(
                    new Vector(this.position.x, this.position.y, this.position.z),
                    new Vector(0, 0, 0)
                );
                const newMicrofauna = new Microfauna(newPosition);
                newMicrofauna.setTank(this.tank);
                this.tank.addMicrofauna(newMicrofauna);
            }
        }
        
        super.update(inhabitants);
    }

    // Inheriting default render and update methods from Inhabitant
} 