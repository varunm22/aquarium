class Fish extends Inhabitant {
    constructor(x, y, z, size) {
      let dx = random(-1, 1); // Random horizontal movement speed
      let dy = random(-1, 1); // Random vertical movement speed
      let dz = random(-1, 1); // Random depth movement speed
      super(x, y, z, dx, dy, dz, size); // Use the base class constructor
    }
  
    update(inhabitants) {
      // React to other fish within the field of view
      const fish_in_view = [];
      for (let other of inhabitants) {
        if (other !== this && this.isInFieldOfView(other, 90, 400)) {
          fish_in_view.push(other);
        }
      }

      this.reactToAllFish(fish_in_view);

      super.update();
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
        this.dx = random(-1, 1);
        this.dy = random(-1, 1);
        this.dz = random(-1, 1);
      }
    }

    reactToFish(other) {
      // NOTE: only using this for user fish so far, should make a general distance one?
      // Basic behavior: move towards other fish if too far
      const distance = this.distanceTo(other);
      if (other instanceof UserFish) {
        this.moveTowards(other);
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
  