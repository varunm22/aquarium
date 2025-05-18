import { Tank } from './tank.js';
import { EmberTetra } from './inhabitants/embertetra.js';
import { UserFish } from './inhabitants/userfish.js';
import { SidePane } from './sidepane.js';
import { getTankBounds } from './constants.js';

// Declare p5.js global functions
declare function createCanvas(w: number, h: number): void;
declare function background(color: number): void;
declare function random(min: number, max: number): number;

let tank: Tank;
let sidePane: SidePane;

function setup(): void {
  createCanvas(1200, 800); // Increased width to accommodate side pane
  
  // Initialize the tank
  tank = new Tank(75, 150, 700, 500, 400);

  // Initialize the side pane
  sidePane = new SidePane(tank);

  // Load the fish spritesheet
  EmberTetra.loadSpritesheet();

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
  let userFish = new UserFish(425, 400, 200, 30); // Start in the middle of the tank
  tank.addFish(userFish); // Add to the tank inhabitants
}

function draw(): void {
  background(255);

  // Update and render the tank
  tank.update();
  tank.render();
  
  // Render the side pane
  sidePane.render(tank);
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
