import { Tank } from './tank.js';
import { EmberTetra } from './inhabitants/embertetra.js';
import { Snail } from './inhabitants/snail.js';
import { SidePane } from './sidepane.js';
import { getTankBounds } from './constants.js';
let tank;
let sidePane;
// Debug display system
class DebugDisplay {
    constructor() {
        this.debugInfo = new Map();
    }
    updateInfo(key, value) {
        this.debugInfo.set(key, value);
    }
    render() {
        fill(0, 0, 0); // Black text
        textSize(12);
        let yOffset = 720; // Start below the tank
        this.debugInfo.forEach((value, key) => {
            text(`${key}: ${value}`, 20, yOffset);
            yOffset += 15;
        });
    }
    clear() {
        this.debugInfo.clear();
    }
}
const debugDisplay = new DebugDisplay();
function setup() {
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
    for (let i = 0; i < 2; i++) {
        const snail = new Snail(20); // Pass debug display to snail
        tank.addFish(snail); // Add to the tank inhabitants
    }
}
function draw() {
    background(255);
    // Update and render the tank
    tank.update();
    tank.render();
    // Render the side pane
    sidePane.render(tank);
    // Render debug display
    debugDisplay.render();
}
window.setup = setup;
window.draw = draw;
