class Inhabitant {
  constructor(x, y, z, size) {
    this.x = x; // Horizontal position
    this.y = y; // Vertical position
    this.z = z; // Depth position
    this.size = size; // Size of the inhabitant
  }

  update() {
    // Default update behavior (e.g., for autonomous inhabitants)
    // This will be overridden in specific classes as needed
  }

  render(tank, color) {
    // Interpolate 2D position based on depth
    const renderX = lerp(tank.x, tank.backX, this.z) + (this.x - tank.x) * lerp(1, 0.7, this.z);
    const renderY = lerp(tank.y, tank.backY, this.z) + (this.y - tank.y) * lerp(1, 0.7, this.z);

    // Scale size based on depth
    const renderSize = this.size * lerp(1, 0.7, this.z);

    // Render the inhabitant
    fill(color); // Use the given color
    noStroke();
    ellipse(renderX, renderY, renderSize, renderSize); // Render as a circle
  }
}
