import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
import { getTankBounds } from '../constants.js';
export class Food {
    constructor(x, y, z) {
        this.tank = null;
        this.position = new Position(new Vector(x, y, z), new Vector(0, 0, 0), false);
        this.size = 3;
        this.inWater = false;
        this.floating = false;
        this.settled = false;
    }
    setTank(tank) {
        this.tank = tank;
    }
    update() {
        if (this.settled)
            return;
        if (!this.inWater) {
            this.position.delta.y += 0.4;
            const bounds = getTankBounds();
            if (this.position.y >= bounds.min.y) {
                this.inWater = true;
                this.floating = true;
                this.position.setShouldConstrain(true);
                this.position.delta = Vector.zero();
                this.position.ddelta = Vector.zero();
            }
        }
        else if (this.floating) {
            // 0.1% chance per frame to start sinking
            if (Math.random() < 0.001) {
                this.floating = false;
            }
        }
        else {
            this.position.delta.y += 0.02;
            if (Math.random() < 0.25) {
                this.position.applyAcceleration(Vector.random(-0.1, 0.1), 2);
            }
        }
        if (!this.floating) {
            this.position.update();
        }
        if (!this.floating && this.isAtBottom()) {
            this.settled = true;
            this.position.delta = Vector.zero();
            this.position.ddelta = Vector.zero();
        }
    }
    render(tank) {
        const { x: renderX, y: renderY, depthScale } = tank.getRenderPosition(this.position.value);
        fill(139, 69, 19);
        noStroke();
        ellipse(renderX, renderY, this.size * depthScale, this.size * depthScale);
    }
    isAtBottom() {
        const bounds = getTankBounds();
        return this.position.y >= bounds.max.y - 2;
    }
}
