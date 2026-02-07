import { Inhabitant } from './inhabitant.js';
import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
import { Snail } from './snail.js';
import { TANK_CONSTANTS } from '../constants.js';
const HATCH_FRAMES = 600; // 10 seconds at 60fps
const BABY_SCATTER_RADIUS = 20;
export class EggClump extends Inhabitant {
    constructor(position, wall) {
        super(new Position(position, new Vector(0, 0, 0), false), 15);
        this.tank = null;
        this.opacity = 180;
        this.wall = wall;
        this.hatchTimer = HATCH_FRAMES;
    }
    setTank(tank) {
        this.tank = tank;
    }
    update(_inhabitants) {
        this.hatchTimer--;
        if (this.hatchTimer <= 0) {
            this.hatch();
        }
    }
    hatch() {
        if (!this.tank)
            return;
        const babyCount = Math.floor(random() * 6) + 5;
        for (let i = 0; i < babyCount; i++) {
            const offset = this.generateBabyOffset();
            const babyPosition = this.clampPositionToWall(this.position.value.copy().addInPlace(offset));
            const babySnail = new Snail(3, babyPosition, this.wall, 0.5);
            babySnail.setTank(this.tank);
            babySnail.setRandomGoal();
            this.tank.addSnail(babySnail);
        }
        this.hatchTimer = -1;
    }
    generateBabyOffset() {
        const angle = random() * Math.PI * 2;
        const distance = random() * BABY_SCATTER_RADIUS;
        switch (this.wall) {
            case 'front':
            case 'back':
                return new Vector(Math.cos(angle) * distance, Math.sin(angle) * distance, 0);
            case 'left':
            case 'right':
                return new Vector(0, Math.cos(angle) * distance, Math.sin(angle) * distance);
            case 'bottom':
                return new Vector(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
            default:
                return Vector.zero();
        }
    }
    clampPositionToWall(pos) {
        const bounds = EggClump.getTankBounds();
        const clampedPos = pos.copy();
        clampedPos.x = Math.max(bounds.minX, Math.min(bounds.maxX, clampedPos.x));
        clampedPos.y = Math.max(bounds.minY, Math.min(bounds.maxY, clampedPos.y));
        clampedPos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, clampedPos.z));
        const wallOffset = this.size / 2;
        switch (this.wall) {
            case 'front':
                clampedPos.z = bounds.minZ + wallOffset;
                break;
            case 'back':
                clampedPos.z = bounds.maxZ - wallOffset;
                break;
            case 'left':
                clampedPos.x = bounds.minX + wallOffset;
                break;
            case 'right':
                clampedPos.x = bounds.maxX - wallOffset;
                break;
            case 'bottom':
                clampedPos.y = bounds.maxY - wallOffset;
                break;
        }
        return clampedPos;
    }
    static getTankBounds() {
        return {
            minX: TANK_CONSTANTS.X,
            maxX: TANK_CONSTANTS.X + TANK_CONSTANTS.WIDTH,
            minY: TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT,
            maxY: TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT - TANK_CONSTANTS.GRAVEL_HEIGHT,
            minZ: TANK_CONSTANTS.MIN_Z,
            maxZ: TANK_CONSTANTS.DEPTH
        };
    }
    shouldBeRemoved() {
        return this.hatchTimer < 0;
    }
    getHatchProgress() {
        return Math.max(0, 1 - (this.hatchTimer / HATCH_FRAMES));
    }
    render(tank, _color) {
        const { x: renderX, y: renderY, depthScale } = tank.getRenderPosition(this.position.value);
        const renderSize = this.size * depthScale;
        push();
        fill(128, 128, 128, this.opacity);
        noStroke();
        ellipse(renderX, renderY, renderSize, renderSize);
        const hatchProgress = this.getHatchProgress();
        if (hatchProgress > 0.8) {
            const pulseIntensity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
            fill(128, 128, 128, this.opacity * pulseIntensity);
            ellipse(renderX, renderY, renderSize * 1.2, renderSize * 1.2);
        }
        pop();
    }
}
