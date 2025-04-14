import { Vector } from './vector.js';

class Position {
  constructor(value, delta) {
    this.value = value;
    this.delta = delta;
    this.ddelta = Vector.zero();
  }

  get x() {
    return this.value.x;
  }

  set x(newX) {
    this.value.x = newX;
  }
  get y() {
    return this.value.y;
  }
  set y(newY) {
    this.value.y = newY;
  }
  get z() {
    return this.value.z;
  }
  set z(newZ) {
    this.value.z = newZ;
  }

  update() {
    this.value = this.value.add(this.delta);
    this.delta = this.delta.add(this.ddelta);
    // Constrain position to the tank bounds
    this.value = this.value.constrainVector(new Vector(150, 150, 20), new Vector(850, 650, 400));
    // Speed decay
    this.delta = this.delta.multiply(0.95);


  }
}

export class Inhabitant {
  constructor(position, velocity, size) {
    this.position = position;
    this.velocity = velocity;
    this.size = size;
  }

  // Calculate the distance to another inhabitant
  distanceTo(other) {
    return this.position.distanceTo(other.position);
  }

  moveTowards(other, maxSpeed = 1, multiplier = 1) {
    this.velocity = this.velocity.add(other.position.subtract(this.position).multiply(multiplier * 0.0001)).constrainScalar(-maxSpeed, maxSpeed);
  }

  moveFrom(other, maxSpeed = 1, multiplier = 1) {
    let diff_vector = other.position.subtract(this.position);
    this.velocity = this.velocity.subtract(diff_vector.multiply(multiplier).divide(diff_vector.magnitude()**2 * 10)).constrainScalar(-maxSpeed, maxSpeed);
  }

  // Calculate if another inhabitant is in view based on angle and distance
  isInFieldOfView(other, maxAngle = 45, maxDistance = 200) {
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

  update() {
    // Update position based on velocity
    this.position = this.position.add(this.velocity);

    // Constrain position within the tank bounds
    this.position = this.position.constrainVector(new Vector(150, 150, 20), new Vector(850, 650, 400));

    // Speed decay
    this.velocity = this.velocity.multiply(0.95);
    // this.position.update()
  }

  render(tank, color) {
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
