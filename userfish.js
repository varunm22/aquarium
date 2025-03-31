class UserFish extends Inhabitant {
  constructor(x, y, z, size) {
    const position = new Vector(x, y, z);
    super(position, Vector.zero(), size); // Use the base class constructor
  }

  update() {
    // Update position based on key presses
    if (keyIsDown(83)) this.position.x -= 5; // 's' key moves left
    if (keyIsDown(70)) this.position.x += 5; // 'f' key moves right
    if (keyIsDown(68)) this.position.y += 5; // 'd' key moves down
    if (keyIsDown(69)) this.position.y -= 5; // 'e' key moves up
    if (keyIsDown(87)) this.position.z += 5; // 'w' key moves further back
    if (keyIsDown(82)) this.position.z -= 5; // 'r' key moves closer to the front

    super.update();
  }

  render(tank) {
    super.render(tank, color(0)); // Render as black
  }
}
