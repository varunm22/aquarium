import { Fish } from './fish.js';
import { Position } from '../factors/position.js';
import { Vector } from '../vector.js';
const MAX_SPRITE_HEIGHT = 41;
export class EmberTetra extends Fish {
    constructor(x, y, z, size) {
        const position = new Position(new Vector(x, y, z), Vector.random(-1, 1), false);
        super(position, size);
    }
    static loadSpritesheet() {
        EmberTetra.spritesheet = loadImage('assets/tetra_small_clear.png');
    }
    render(tank, _color) {
        const { x: renderX, y: renderY, depthScale } = tank.getRenderPosition(this.position.value);
        const { index, mirrored } = this.getSpriteIndex();
        const spriteConfig = EmberTetra.SPRITE_CONFIGS[index];
        const scale_size = (this.size * depthScale) / MAX_SPRITE_HEIGHT;
        const spriteWidth = spriteConfig.width * scale_size;
        const spriteHeight = spriteConfig.height * scale_size;
        const tilt = this.getVerticalTilt();
        push();
        translate(renderX, renderY);
        rotate(tilt);
        if (mirrored) {
            scale(-1, 1);
        }
        image(EmberTetra.spritesheet, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight, spriteConfig.x, spriteConfig.y, spriteConfig.width, spriteConfig.height);
        pop();
    }
    getSpriteInfo() {
        return this.getSpriteIndex();
    }
}
EmberTetra.spritesheet = null;
EmberTetra.SPRITE_CONFIGS = [
    { x: 3, y: 54, width: 34, height: 41 }, // front
    { x: 129, y: 54, width: 48, height: 41 }, // front-left
    { x: 76, y: 54, width: 50, height: 41 }, // left
    { x: 182, y: 54, width: 32, height: 40 }, // back-left
    { x: 44, y: 54, width: 26, height: 41 } // back
];
