import { Inhabitant } from './inhabitant.js';
import { Vector } from './vector.js';
import { Tank } from './tank.js';

// Declare p5.js global functions
declare function color(r: number, g: number, b: number): p5.Color;
declare function keyIsDown(keyCode: number): boolean;

// Declare p5.Color type
declare namespace p5 {
  interface Color {}
}

export class UserFish extends Inhabitant {
  constructor(x: number, y: number, z: number, size: number) {
    const position = new Vector(x, y, z);
    super(position, Vector.zero(), size); // Use the base class constructor
  }

  update(): void {
    // Update position based on key presses
    if (keyIsDown(83)) this.position.x -= 5; // 's' key moves left
    if (keyIsDown(70)) this.position.x += 5; // 'f' key moves right
    if (keyIsDown(68)) this.position.y += 5; // 'd' key moves down
    if (keyIsDown(69)) this.position.y -= 5; // 'e' key moves up
    if (keyIsDown(87)) this.position.z += 5; // 'w' key moves further back
    if (keyIsDown(82)) this.position.z -= 5; // 'r' key moves closer to the front

    super.update();
  }

  render(tank: Tank): void {
    super.render(tank, color(0, 0, 0)); // Render as black
  }
}
