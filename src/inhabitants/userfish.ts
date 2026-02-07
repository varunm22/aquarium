import { Inhabitant } from './inhabitant.js';
import { Vector } from '../vector.js';
import { Tank } from '../tank.js';
import { Position } from '../factors/position.js';

declare function color(r: number, g: number, b: number): p5.Color;
declare function keyIsDown(keyCode: number): boolean;

declare namespace p5 {
  interface Color {}
}

export class UserFish extends Inhabitant {
  constructor(x: number, y: number, z: number, size: number) {
    super(new Position(new Vector(x, y, z), Vector.zero()), size);
  }

  update(): void {
    if (keyIsDown(83)) this.position.x -= 5;
    if (keyIsDown(70)) this.position.x += 5;
    if (keyIsDown(68)) this.position.y += 5;
    if (keyIsDown(69)) this.position.y -= 5;
    if (keyIsDown(87)) this.position.z += 5;
    if (keyIsDown(82)) this.position.z -= 5;
    super.update();
  }

  render(tank: Tank): void {
    super.render(tank, color(0, 0, 255));
  }
}
