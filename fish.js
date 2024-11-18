class Fish extends Inhabitant {
    constructor(x, y, z, size) {
      super(x, y, z, size); // Use the base class constructor
      this.dx = random(-1, 1); // Random horizontal movement speed
      this.dy = random(-1, 1); // Random vertical movement speed
      this.dz = random(-0.01, 0.01); // Random depth movement speed
    }
  
    update() {
      // Update position based on velocity
      this.x += this.dx;
      this.y += this.dy;
      this.z += this.dz;
  
      // Constrain position within the tank bounds
      this.x = constrain(this.x, 150, 850); // Horizontal bounds
    this.y = constrain(this.y, 150 + 0.1 * 500, 650); // Vertical bounds (90% of tank height)
      this.z = constrain(this.z, 0.05, 1); // Depth bounds
    }
  
    render(tank) {
      super.render(tank, color(255, 200, 0)); // Render as yellow
    }
  }
  