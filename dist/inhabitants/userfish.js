import { Inhabitant } from './inhabitant.js';
import { Vector } from '../vector.js';
import { Position } from '../factors/position.js';
export class UserFish extends Inhabitant {
    constructor(x, y, z, size) {
        super(new Position(new Vector(x, y, z), Vector.zero()), size);
    }
    update() {
        if (keyIsDown(83))
            this.position.x -= 5;
        if (keyIsDown(70))
            this.position.x += 5;
        if (keyIsDown(68))
            this.position.y += 5;
        if (keyIsDown(69))
            this.position.y -= 5;
        if (keyIsDown(87))
            this.position.z += 5;
        if (keyIsDown(82))
            this.position.z -= 5;
        super.update();
    }
    render(tank) {
        super.render(tank, color(0, 0, 255));
    }
}
