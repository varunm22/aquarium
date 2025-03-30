class Fish extends Inhabitant {
    constructor(x, y, z, size) {
      super(x, y, z, size); // Use the base class constructor
      this.dx = random(-1, 1); // Random horizontal movement speed
      this.dy = random(-1, 1); // Random vertical movement speed
      this.dz = random(-0.01, 0.01); // Random depth movement speed
    }
  
    update(inhabitants) {
      // Update position based on velocity
      this.x += this.dx;
      this.y += this.dy;
      this.z += this.dz;
  
      // Constrain position within the tank bounds
      this.x = constrain(this.x, 150, 850); // Horizontal bounds
      this.y = constrain(this.y, 150 + 0.1 * 500, 650); // Vertical bounds (90% of tank height)
      this.z = constrain(this.z, 20, 400); // Depth bounds

      // React to other fish within the field of view
      const fish_in_view = [];
      for (let other of inhabitants) {
        if (other !== this && this.isInFieldOfView(other, 360)) {
          fish_in_view.push(other);
        }
      }

      this.reactToAllFish(fish_in_view);
    }


    reactToAllFish(fish_in_view) {
      let can_see_user_fish = false;
      for (let other of fish_in_view) {
        if (other instanceof UserFish) {
          can_see_user_fish = true;
          this.reactToFish(other);
        }
      }
      if (!can_see_user_fish) {
        this.dx = random(-0.01, 0.01);
        this.dy = random(-0.01, 0.01);
        this.dz = random(-0.01, 0.01);
      }
    }

    reactToFish(other) {
      // NOTE: only using this for user fish so far, should make a general distance one?
      // Basic behavior: move towards other fish if too far
      const distance = this.distanceTo(other);
      if (other instanceof UserFish) {
        this.dx = Math.max(Math.min(this.dx + (other.x - this.x) * 0.001, 1), -1);
        this.dy = Math.max(Math.min(this.dy + (other.y - this.y) * 0.001, 1), -1);
        this.dz = Math.max(Math.min(this.dz + (other.z - this.z) * 0.001, 1), -1);
      } else {
        // if (distance > 100) { // If too far
        //   this.dx -= (this.x - other.x) * 0.0001;
        //   this.dy -= (this.y - other.y) * 0.0001;
        //   this.dz -= (this.z - other.z) * 0.0001;
        // } else if (distance < 20) { // If too close
        //   this.dx += (this.x - other.x) * 0.01;
        //   this.dy += (this.y - other.y) * 0.01;
        //   this.dz += (this.z - other.z) * 0.01;
        // }
      }
    }
  
    render(tank) {
      super.render(tank, color(255, 200, 0)); // Render as yellow
    }
  }
  