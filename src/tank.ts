import { Inhabitant } from './inhabitant.js';
import { TANK_CONSTANTS } from './constants.js';

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
declare function image(img: HTMLImageElement, x: number, y: number, w: number, h: number): void;
declare function push(): void;
declare function pop(): void;
declare function loadImage(path: string): HTMLImageElement;


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
    gravelBottom: HTMLImageElement | null; // Reference to the gravel texture image for bottom
    gravelFront: HTMLImageElement | null; // Reference to the gravel texture image for front
    gravelHeight: number;

    constructor(x: number, y: number, width: number, height: number, depth: number) {
        // Use constants for initialization
        this.x = TANK_CONSTANTS.X;
        this.y = TANK_CONSTANTS.Y;
        this.width = TANK_CONSTANTS.WIDTH;
        this.height = TANK_CONSTANTS.HEIGHT;
        this.depth = TANK_CONSTANTS.DEPTH;
        
        // Calculate derived values using the same constants
        this.backX = this.x + (this.width - this.width * TANK_CONSTANTS.BACK_SCALE) / 2;
        this.backY = this.y + (this.height - this.height * TANK_CONSTANTS.BACK_SCALE) / 2;
        this.backWidth = this.width * TANK_CONSTANTS.BACK_SCALE;
        this.backHeight = this.height * TANK_CONSTANTS.BACK_SCALE;
        
        this.waterLevelTop = this.y + this.height * TANK_CONSTANTS.WATER_LEVEL_PERCENT;
        this.waterLevelBottom = this.y + this.height;
        this.waterLevelTopBack = this.backY + this.backHeight * TANK_CONSTANTS.WATER_LEVEL_PERCENT;
        this.waterLevelBottomBack = this.backY + this.backHeight;
  
        this.numLayers = 20;
        this.fish = [];
        this.gravelBottom = loadImage('assets/gravel-transform.png');
        this.gravelFront = loadImage('assets/gravel-front.png');
        this.gravelHeight = TANK_CONSTANTS.GRAVEL_HEIGHT;
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

      // Render gravel
      this.renderGravel();
    
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

    private renderGravel(): void {
      // Skip if texture isn't loaded yet
      if (!this.gravelBottom || !this.gravelFront) return;

      push();
      
      // Calculate scaling factor based on tank width
      const scale = this.width / 896;  // scale to fit tank width
      const scaledWidth = 896 * scale;
      const scaledHeight = 512 * scale;
      
      // Position the image:
      // x: align with tank left edge
      // y: align bottom of image with bottom of tank
      image(
        this.gravelBottom,
        this.x,                           // left align with tank
        this.waterLevelBottom - scaledHeight - TANK_CONSTANTS.GRAVEL_HEIGHT,  // bottom align with tank
        scaledWidth,
        scaledHeight
      );
      image(
        this.gravelFront,
        this.x,
        this.waterLevelBottom - TANK_CONSTANTS.GRAVEL_HEIGHT,
        scaledWidth,
        TANK_CONSTANTS.GRAVEL_HEIGHT,
        // @ts-ignore
        0,
        0,
        896,
        TANK_CONSTANTS.GRAVEL_HEIGHT/scale,
      );
      
      pop();
    }
}
  