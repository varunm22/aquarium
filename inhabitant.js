class Inhabitant {
  constructor(x, y, z, dx, dy, dz, size) {
    this.x = x; // Horizontal position
    this.y = y; // Vertical position
    this.z = z; // Depth position
    this.dx = dx; // Horizontal speed
    this.dy = dy; // Vertical speed
    this.dz = dz; // Depth speed
    this.size = size; // Size of the inhabitant
  }

  // Calculate the distance to another inhabitant
  distanceTo(other) {
    return dist(this.x, this.y, other.x, other.y);
  }

  moveTowards(other, maxSpeed = 1) {
    this.dx = Math.max(Math.min(this.dx + (other.x - this.x) * 0.001, maxSpeed), -1 * maxSpeed);
    this.dy = Math.max(Math.min(this.dy + (other.y - this.y) * 0.001, maxSpeed), -1 * maxSpeed);
    this.dz = Math.max(Math.min(this.dz + (other.z - this.z) * 0.001, maxSpeed), -1 * maxSpeed);
  }

  // Calculate if another inhabitant is in view based on angle and distance
  isInFieldOfView(other, maxAngle = 45, maxDistance = 200) {
    // Direction vector from the current fish to the other
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    const dz = other.z - this.z;

    // Calculate the 3D distance
    const distance = this.distanceTo(other);

    // Normalize the direction vector
    const directionMagnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const dxNormalized = dx / directionMagnitude;
    const dyNormalized = dy / directionMagnitude;
    const dzNormalized = dz / directionMagnitude;

    // Assume the fish faces along the positive z-axis (depth)
    const fishFacingZ = 0; // Facing straight along z-axis
    const fishFacingY = 0;
    const fishFacingX = 1;

    // Dot product between the fish's facing direction and the direction to the other fish
    const dotProduct = dxNormalized * fishFacingX + dyNormalized * fishFacingY + dzNormalized * fishFacingZ;

    // Angle between the vectors
    const angle = Math.acos(dotProduct); // Angle between the vectors in radians
    const angleDegrees = degrees(angle); // Convert to degrees

    // Return true if the fish is within the angle and distance threshold
    return angleDegrees <= maxAngle && distance <= maxDistance;
  }

  update() {
    // Default update behavior

    // Update position based on velocity
    this.x += this.dx;
    this.y += this.dy;
    this.z += this.dz;

    // Constrain position within the tank bounds
    this.x = constrain(this.x, 150, 850); // Horizontal bounds
    this.y = constrain(this.y, 150 + 0.1 * 500, 650); // Vertical bounds (90% of tank height)
    this.z = constrain(this.z, 20, 400); // Depth bounds

    // Speed decay
    this.dx *= 0.95; // Slow down horizontal speed
    this.dy *= 0.95; // Slow down horizontal speed
    this.dz *= 0.95; // Slow down horizontal speed
  }

  render(tank, color) {
    // Interpolate 2D position based on depth
    const relativeDepth = this.z / tank.depth;
    const renderX = lerp(tank.x, tank.backX, relativeDepth) + (this.x - tank.x) * lerp(1, 0.7, relativeDepth);
    const renderY = lerp(tank.y, tank.backY, relativeDepth) + (this.y - tank.y) * lerp(1, 0.7, relativeDepth);

    // Scale size based on depth
    const renderSize = this.size * lerp(1, 0.7, relativeDepth);

    // Render the inhabitant
    fill(color); // Use the given color
    noStroke();
    ellipse(renderX, renderY, renderSize, renderSize); // Render as a circle
  }
}
