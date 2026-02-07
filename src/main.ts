import { Tank } from './tank.js';
import { EmberTetra } from './inhabitants/embertetra.js';
import { UserFish } from './inhabitants/userfish.js';
// import { Snail } from './inhabitants/snail.js';
import { Snail } from './inhabitants/snail_new.js';
import { SidePane } from './sidepane.js';
import { getTankBounds } from './constants.js';

// Declare p5.js global functions
declare function createCanvas(w: number, h: number): void;
declare function background(color: number): void;
declare function random(min: number, max: number): number;
declare function fill(r: number, g: number, b: number): void;
declare function text(str: string, x: number, y: number): void;
declare function textSize(size: number): void;

let tank: Tank;
let sidePane: SidePane;

// Debug display system
class DebugDisplay {
  private debugInfo: Map<string, string> = new Map();
  
  updateInfo(key: string, value: string): void {
    this.debugInfo.set(key, value);
  }
  
  render(): void {
    fill(0, 0, 0); // Black text
    textSize(12);
    
    let yOffset = 720; // Start below the tank
    this.debugInfo.forEach((value, key) => {
      text(`${key}: ${value}`, 20, yOffset);
      yOffset += 15;
    });
  }
  
  clear(): void {
    this.debugInfo.clear();
  }
}

const debugDisplay = new DebugDisplay();

function setup(): void {
  createCanvas(1200, 800); // Increased width to accommodate side pane
  
  // Initialize the tank
  tank = new Tank(75, 150, 700, 500, 400);

  // Initialize the side pane
  sidePane = new SidePane(tank);

  // Load the fish spritesheet
  EmberTetra.loadSpritesheet();
  
  // Load the snail spritesheet
  Snail.loadSpritesheet();

  // Get tank bounds for proper fish placement
  const bounds = getTankBounds();

  // Add fish to the tank with random 3D positions and sizes
  for (let i = 0; i < 10; i++) {
    const x = random(bounds.min.x, bounds.max.x);
    const y = random(bounds.min.y, bounds.max.y);
    const z = random(bounds.min.z, bounds.max.z);
    const size = random(20, 30); // Random size for fish
    const fish = new EmberTetra(x, y, z, size);
    tank.addFish(fish);
  }

  // Add the user-controlled fish
  // let userFish = new UserFish(425, 400, 200, 30); // Start in the middle of the tank
  // tank.addFish(userFish); // Add to the tank inhabitants

  // Add a snail on a random wall
  for (let i = 0; i < 1; i++) {
    const snail = new Snail(28); // Pass debug display to snail
    snail.setTank(tank); // Set tank reference for reproduction
    tank.addFish(snail); // Add to the tank inhabitants
  }
}

function draw(): void {
  background(255);

  // Update and render the tank
  tank.update();
  tank.render();
  
  // Render the side pane
  sidePane.render(tank);
  
  // Update debug info
  updateDebugInfo();
  
  // Render debug display
  debugDisplay.render();
}

function updateDebugInfo(): void {
  const snails = tank.getSnails();
  let normalSnails = 0;
  
  snails.forEach(snail => {
    switch (snail.getLifeState()) {
      case 'normal': normalSnails++; break;
    }
  });
  
  debugDisplay.updateInfo('Snails', `Total: ${snails.length} | Normal: ${normalSnails}`);
  
  if (snails.length > 0) {
    const firstSnail = snails[0];
    debugDisplay.updateInfo('First Snail', `Size: ${firstSnail.size} | Hunger: ${Math.round(firstSnail.getHungerValue() * 100)}% | State: ${firstSnail.getLifeState()}`);
  }
}

// Make setup and draw available to p5.js
declare global {
  interface Window {
    setup: typeof setup;
    draw: typeof draw;
  }
}

window.setup = setup;
window.draw = draw;
