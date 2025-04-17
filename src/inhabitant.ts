import { Vector } from './vector.js';
import { Tank } from './tank.js';

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

class Position {
  value: Vector;
  delta: Vector;
  ddelta: Vector;

  constructor(value: Vector, delta: Vector) {
    this.value = value;
    this.delta = delta;
    this.ddelta = Vector.zero();
  }

  get x(): number {
    return this.value.x;
  }

  set x(newX: number) {
    this.value.x = newX;
  }

  get y(): number {
    return this.value.y;
  }

  set y(newY: number) {
    this.value.y = newY;
  }

  get z(): number {
    return this.value.z;
  }

  set z(newZ: number) {
    this.value.z = newZ;
  }

  update(): void {
    this.value = this.value.add(this.delta);
    this.delta = this.delta.add(this.ddelta);
    // Constrain position to the tank bounds
    this.value = this.value.constrainVector(new Vector(150, 150, 20), new Vector(850, 650, 400));
    // Speed decay
    this.delta = this.delta.multiply(0.95);
  }
}

export class Inhabitant {
  position: Vector;
  velocity: Vector;
  size: number;

  constructor(position: Vector, velocity: Vector, size: number) {
    this.position = position;
    this.velocity = velocity;
    this.size = size;
  }

  distanceTo(other: Inhabitant): number {
    return this.position.distanceTo(other.position);
  }

  moveTowards(other: Inhabitant, maxSpeed: number = 1, multiplier: number = 1): void {
    this.velocity = this.velocity.add(other.position.subtract(this.position).multiply(multiplier * 0.0001)).constrainScalar(-maxSpeed, maxSpeed);
  }

  moveFrom(other: Inhabitant, maxSpeed: number = 1, multiplier: number = 1): void {
    let diff_vector = other.position.subtract(this.position);
    this.velocity = this.velocity.subtract(diff_vector.multiply(multiplier).divide(diff_vector.magnitude()**2 * 10)).constrainScalar(-maxSpeed, maxSpeed);
  }

  isInFieldOfView(other: Inhabitant, maxAngle: number = 45, maxDistance: number = 200): boolean {
    // Direction vector from the current fish to the other
    const disp = other.position.subtract(this.position);

    // Calculate the 3D distance
    const distance = this.distanceTo(other);

    // Normalize the direction vector
    const disp_norm = disp.divide(disp.magnitude());

    // Dot product between the fish's facing direction and the direction to the other fish
    const fish_dir = this.velocity.divide(this.velocity.magnitude());
    const dotProduct = disp_norm.dotProduct(fish_dir)

    // Angle between the vectors
    const angle = Math.acos(dotProduct); // Angle between the vectors in radians
    const angleDegrees = degrees(angle); // Convert to degrees

    // Return true if the fish is within the angle and distance threshold
    return angleDegrees <= maxAngle && distance <= maxDistance;
  }

  update(inhabitants: Inhabitant[] = []): void {
    // Update position based on velocity
    this.position = this.position.add(this.velocity);

    // Constrain position within the tank bounds
    this.position = this.position.constrainVector(new Vector(150, 150, 20), new Vector(850, 650, 400));

    // Speed decay
    this.velocity = this.velocity.multiply(0.95);
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
