import { Inhabitant } from './inhabitant.js';

// Declare p5.js global functions
declare function color(r: number, g: number, b: number, a?: number): p5.Color;
declare function lerp(start: number, stop: number, amt: number): number;
declare function map(value: number, start1: number, stop1: number, start2: number, stop2: number): number;
declare function fill(color: p5.Color): void;
declare function fill(r: number, g: number, b: number, a?: number): void;
declare function noStroke(): void;
declare function stroke(color: number): void;
declare function strokeWeight(weight: number): void;
declare function line(x1: number, y1: number, x2: number, y2: number): void;
declare function rect(x: number, y: number, w: number, h: number): void;

// Declare p5.Color type
declare namespace p5 {
  interface Color {}
}

export class Tank {
    x: number; // Front pane top-left X
    y: number; // Front pane top-left Y
    width: number; // Width of the front pane
    height: number; // Height of the front pane
    depth: number; // Depth of the tank

    // Back pane properties (scaled and centered)
    backX: number; // Centered back pane X
    backY: number; // Centered back pane Y
    backWidth: number;
    backHeight: number;

    // Water level properties
    waterLevelTop: number; // 10% below the top
    waterLevelBottom: number; // Bottom of the tank
    waterLevelTopBack: number; // 10% below the top for the back pane
    waterLevelBottomBack: number; // Bottom of the back pane

    numLayers: number; // Number of water tint layers
    fish: Inhabitant[]; // Array to store fish objects

    constructor(x: number, y: number, width: number, height: number, depth: number) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.depth = depth;
  
      // Back pane properties (scaled and centered)
      this.backX = this.x + (this.width - this.width * 0.7) / 2;
      this.backY = this.y + (this.height - this.height * 0.7) / 2;
      this.backWidth = this.width * 0.7;
      this.backHeight = this.height * 0.7;
  
      // Water level properties
      this.waterLevelTop = this.y + this.height * 0.1;
      this.waterLevelBottom = this.y + this.height;
      this.waterLevelTopBack = this.backY + this.backHeight * 0.1;
      this.waterLevelBottomBack = this.backY + this.backHeight;
  
      this.numLayers = 20;
      this.fish = [];
    }
  
    addFish(fish: Inhabitant): void {
      this.fish.push(fish);
    }
  
    update(): void {
      // Update all fish in the tank
      for (let fish of this.fish) {
        fish.update(this.fish);
      }
    }

    render(): void {
      // Sort fish by depth (further fish first)
      this.fish.sort((a, b) => b.position.z - a.position.z);
    
      // Render back pane (before any water layers)
      this.renderBack();
    
      // Render fish behind the first water layer (z > this.depth, at the absolute back)
      for (let fish of this.fish) {
        if (fish.position.z >= this.depth) {
          fish.render(this, color(173, 216, 230));
        }
      }
    
      // Render water layers from back to front
      for (let i = this.numLayers - 1; i >= 0; i--) {
        const interp = i / this.numLayers;
        const nextInterp = (i + 1) / this.numLayers;
    
        const layerZStart = interp * this.depth;
        const layerZEnd = nextInterp * this.depth;
    
        // Render fish that fall within this layer
        for (let fish of this.fish) {
          if (fish.position.z >= layerZStart && fish.position.z < layerZEnd) {
            fish.render(this, color(173, 216, 230));
          }
        }
    
        // Render the water layer itself
        const layerX = lerp(this.x, this.backX, interp);
        const layerYTop = lerp(this.waterLevelTop, this.waterLevelTopBack, interp);
        const layerYBottom = lerp(this.waterLevelBottom, this.backY + this.backHeight, interp);
        const layerWidth = lerp(this.width, this.backWidth, interp);
        const layerHeight = layerYBottom - layerYTop;
    
        fill(173, 216, 230, map(i, 0, this.numLayers, 30, 0));
        noStroke();
        rect(layerX, layerYTop, layerWidth, layerHeight);
      }
    
      // Render fish in front of the last water layer (z < 0, at the absolute front)
      for (let fish of this.fish) {
        if (fish.position.z < 0) {
          fish.render(this, color(173, 216, 230));
        }
      }
    
      // Render front pane (after all water layers and fish)
      this.renderFront();
    }
      
    renderBack(): void {
      // BACK: Render back pane outline
      stroke(0);
      strokeWeight(10);
      line(this.backX, this.backY, this.backX + this.backWidth, this.backY);
      line(this.backX, this.backY + this.backHeight, this.backX + this.backWidth, this.backY + this.backHeight);
  
      strokeWeight(5);
      line(this.backX, this.backY, this.backX, this.backY + this.backHeight);
      line(this.backX + this.backWidth, this.backY, this.backX + this.backWidth, this.backY + this.backHeight);
  
      // SIDE: Render side pane connecting lines
      strokeWeight(5);
      line(this.x, this.y, this.backX, this.backY);
      line(this.x + this.width, this.y, this.backX + this.backWidth, this.backY);
      line(this.x, this.y + this.height, this.backX, this.backY + this.backHeight);
      line(this.x + this.width, this.y + this.height, this.backX + this.backWidth, this.backY + this.backHeight);
  
      // SIDE: Render side pane water level lines
      strokeWeight(2);
      line(this.x, this.waterLevelTop, this.backX, this.waterLevelTopBack);
      line(this.x + this.width, this.waterLevelTop, this.backX + this.backWidth, this.waterLevelTopBack);
  
      // BACK: Render back water level line
      line(this.backX, this.waterLevelTopBack, this.backX + this.backWidth, this.waterLevelTopBack);
    }
  
    renderFront(): void {
      // FRONT: Render front pane outline
      stroke(0);
      strokeWeight(10);
      line(this.x, this.y, this.x + this.width, this.y);
      line(this.x, this.y + this.height, this.x + this.width, this.y + this.height);
  
      strokeWeight(5);
      line(this.x, this.y, this.x, this.y + this.height);
      line(this.x + this.width, this.y, this.x + this.width, this.y + this.height);
  
      // FRONT: Render front water level line
      strokeWeight(2);
      line(this.x, this.waterLevelTop, this.x + this.width, this.waterLevelTop);
    }
}
  