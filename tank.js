class Tank {
    constructor(x, y, width, height, depth) {
      this.x = x; // Front pane top-left X
      this.y = y; // Front pane top-left Y
      this.width = width; // Width of the front pane
      this.height = height; // Height of the front pane
      this.depth = depth; // Depth of the tank
  
      // Back pane properties (scaled and centered)
      this.backX = this.x + (this.width - this.width * 0.7) / 2; // Centered back pane X
      this.backY = this.y + (this.height - this.height * 0.7) / 2; // Centered back pane Y
      this.backWidth = this.width * 0.7;
      this.backHeight = this.height * 0.7;
  
      // Water level properties
      this.waterLevelTop = this.y + this.height * 0.1; // 10% below the top
      this.waterLevelBottom = this.y + this.height; // Bottom of the tank
      this.waterLevelTopBack = this.backY + this.backHeight * 0.1; // 10% below the top for the back pane
      this.waterLevelBottomBack = this.backY + this.backHeight; // Bottom of the back pane
  
      this.numLayers = 20; // Number of water tint layers
      this.fish = []; // Array to store fish objects
    }
  
    addFish(fish) {
      this.fish.push(fish);
    }
  
    update() {
      // Update all fish in the tank
      for (let fish of this.fish) {
        fish.update(this.fish);
      }
    }

    render() {
      // Sort fish by depth (further fish first)
      this.fish.sort((a, b) => b.position.z - a.position.z);
    
      // Render back pane (before any water layers)
      this.renderBack();
    
      // Render fish behind the first water layer (z > this.depth, at the absolute back)
      for (let fish of this.fish) {
        if (fish.position.z >= this.depth) {
          fish.render(this);
        }
      }
    
      // Render water layers from back to front
      for (let i = this.numLayers - 1; i >= 0; i--) {
        const interp = i / this.numLayers; // Interpolation factor
        const nextInterp = (i + 1) / this.numLayers; // Next layer's interpolation factor
    
        const layerZStart = interp * this.depth;
        const layerZEnd = nextInterp * this.depth;
    
        // Render fish that fall within this layer
        for (let fish of this.fish) {
          if (fish.position.z >= layerZStart && fish.position.z < layerZEnd) {
            fish.render(this);
          }
        }
    
        // Render the water layer itself
        const layerX = lerp(this.x, this.backX, interp);
        const layerYTop = lerp(this.waterLevelTop, this.waterLevelTopBack, interp);
        const layerYBottom = lerp(this.waterLevelBottom, this.backY + this.backHeight, interp);
        const layerWidth = lerp(this.width, this.backWidth, interp);
        const layerHeight = layerYBottom - layerYTop;
    
        fill(173, 216, 230, map(i, 0, this.numLayers, 30, 0)); // Light blue color with opacity
        noStroke();
        rect(layerX, layerYTop, layerWidth, layerHeight);
      }
    
      // Render fish in front of the last water layer (z < 0, at the absolute front)
      for (let fish of this.fish) {
        if (fish.position.z < 0) {
          fish.render(this);
        }
      }
    
      // Render front pane (after all water layers and fish)
      this.renderFront();
    }
      

    renderBack() {
      // BACK: Render back pane outline
      stroke(0);
      strokeWeight(10); // Thick for horizontal lines
      line(this.backX, this.backY, this.backX + this.backWidth, this.backY); // Back top horizontal
      line(this.backX, this.backY + this.backHeight, this.backX + this.backWidth, this.backY + this.backHeight); // Back bottom horizontal
  
      strokeWeight(5); // Thin for vertical lines
      line(this.backX, this.backY, this.backX, this.backY + this.backHeight); // Back left vertical
      line(this.backX + this.backWidth, this.backY, this.backX + this.backWidth, this.backY + this.backHeight); // Back right vertical
  
      // SIDE: Render side pane connecting lines
      strokeWeight(5); // Thin for side connecting lines
      line(this.x, this.y, this.backX, this.backY); // Top-left connecting line
      line(this.x + this.width, this.y, this.backX + this.backWidth, this.backY); // Top-right connecting line
      line(this.x, this.y + this.height, this.backX, this.backY + this.backHeight); // Bottom-left connecting line
      line(this.x + this.width, this.y + this.height, this.backX + this.backWidth, this.backY + this.backHeight); // Bottom-right connecting line
  
      // SIDE: Render side pane water level lines
      strokeWeight(2); // Thin water level lines
      line(this.x, this.waterLevelTop, this.backX, this.waterLevelTopBack); // Left water level connecting line
      line(this.x + this.width, this.waterLevelTop, this.backX + this.backWidth, this.waterLevelTopBack); // Right water level connecting line
  
      // BACK: Render back water level line
      line(this.backX, this.waterLevelTopBack, this.backX + this.backWidth, this.waterLevelTopBack);
    }
  
    renderFront() {
      // FRONT: Render front pane outline
      stroke(0);
      strokeWeight(10); // Thick horizontal lines
      line(this.x, this.y, this.x + this.width, this.y); // Front top horizontal
      line(this.x, this.y + this.height, this.x + this.width, this.y + this.height); // Front bottom horizontal
  
      strokeWeight(5); // Thin vertical lines
      line(this.x, this.y, this.x, this.y + this.height); // Front left vertical
      line(this.x + this.width, this.y, this.x + this.width, this.y + this.height); // Front right vertical
  
      // FRONT: Render front water level line
      strokeWeight(2); // Thin water level line
      line(this.x, this.waterLevelTop, this.x + this.width, this.waterLevelTop);
    }
  }
  