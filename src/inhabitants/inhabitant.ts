import { Tank } from '../tank.js';
import { Position } from '../factors/position.js';

// Declare p5.js global functions
declare function degrees(radians: number): number;
declare function lerp(start: number, stop: number, amt: number): number;
declare function fill(color: p5.Color): void;
declare function noStroke(): void;
declare function ellipse(x: number, y: number, w: number, h: number): void;

// Declare p5.Color type
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
    // Direction vector from the current fish to the other
    const disp = other.position.value.subtract(this.position.value);

    // Calculate the 3D distance
    const distance = this.distanceTo(other);

    // Normalize the direction vector
    const disp_norm = disp.divide(disp.magnitude());

    // Dot product between the fish's facing direction and the direction to the other fish
    const fish_dir = this.position.delta.divide(this.position.delta.magnitude());
    const dotProduct = disp_norm.dotProduct(fish_dir)

    // Angle between the vectors
    const angle = Math.acos(dotProduct); // Angle between the vectors in radians
    const angleDegrees = degrees(angle); // Convert to degrees

    // Return true if the fish is within the angle and distance threshold
    return angleDegrees <= maxAngle && distance <= maxDistance;
  }

  update(inhabitants: Inhabitant[] = []): void {
    // Update position based on velocity
    this.position.update();
  }

  render(tank: Tank, color: p5.Color): void {
    // Interpolate 2D position based on depth
    const relativeDepth = this.position.z / tank.depth;
    const renderX = lerp(tank.x, tank.backX, relativeDepth) + (this.position.x - tank.x) * lerp(1, 0.7, relativeDepth);
    const renderY = lerp(tank.y, tank.backY, relativeDepth) + (this.position.y - tank.y) * lerp(1, 0.7, relativeDepth);

    // Scale size based on depth
    const renderSize = this.size * lerp(1, 0.7, relativeDepth);

    // Render the inhabitant
    fill(color); // Use the given color
    noStroke();
    ellipse(renderX, renderY, renderSize, renderSize); // Render as a circle
  }
}
