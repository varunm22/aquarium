import { Tank } from '../tank.js';
import { Position } from '../factors/position.js';

declare function degrees(radians: number): number;
declare function fill(color: p5.Color): void;
declare function noStroke(): void;
declare function ellipse(x: number, y: number, w: number, h: number): void;

declare namespace p5 {
  interface Color {}
}

export class Inhabitant {
  position: Position;
  size: number;

  constructor(position: Position, size: number) {
    this.position = position;
    this.size = size;
  }

  distanceTo(other: Inhabitant): number {
    return this.position.value.distanceTo(other.position.value);
  }

  isInFieldOfView(other: Inhabitant, maxAngle: number = 45, maxDistance: number = 200): boolean {
    const disp = other.position.value.subtract(this.position.value);
    const distance = this.distanceTo(other);
    const disp_norm = disp.divide(disp.magnitude());
    const fish_dir = this.position.delta.divide(this.position.delta.magnitude());
    const dotProduct = disp_norm.dotProduct(fish_dir);
    const angle = Math.acos(dotProduct);
    return degrees(angle) <= maxAngle && distance <= maxDistance;
  }

  update(_inhabitants: Inhabitant[] = []): void {
    this.position.update();
  }

  render(tank: Tank, color: p5.Color): void {
    const { x: renderX, y: renderY, depthScale } = tank.getRenderPosition(this.position.value);
    fill(color);
    noStroke();
    ellipse(renderX, renderY, this.size * depthScale, this.size * depthScale);
  }
}
