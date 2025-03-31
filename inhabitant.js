class Inhabitant {
  constructor(position, velocity, size) {
    this.position = position;
    this.velocity = velocity;
    this.size = size;
  }

  // Calculate the distance to another inhabitant
  distanceTo(other) {
    return this.position.distanceTo(other.position);
  }

  moveTowards(other, maxSpeed = 1) {
    this.velocity = other.position.subtract(this.position).multiply(0.001).add(this.velocity).constrainScalar(-maxSpeed, maxSpeed);
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
