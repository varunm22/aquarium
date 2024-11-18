class UserFish extends Inhabitant {
  constructor(x, y, z, size) {
    super(x, y, z, size); // Use the base class constructor
  }

  update() {
    // Update position based on key presses
    if (keyIsDown(83)) this.x -= 5; // 's' key moves left
    if (keyIsDown(70)) this.x += 5; // 'f' key moves right
    if (keyIsDown(68)) this.y += 5; // 'd' key moves down
    if (keyIsDown(69)) this.y -= 5; // 'e' key moves up
    if (keyIsDown(87)) this.z += 0.05; // 'w' key moves further back
    if (keyIsDown(82)) this.z -= 0.05; // 'r' key moves closer to the front

    // Constrain position within the tank bounds
    this.x = constrain(this.x, 150, 850); // Horizontal bounds
    this.y = constrain(this.y, 150 + 0.1 * 500, 650); // Vertical bounds (90% of tank height)

    this.z = constrain(this.z, 0.05, 1); // Depth bounds
  }

  render(tank) {
    super.render(tank, color(0)); // Render as black
  }
}
