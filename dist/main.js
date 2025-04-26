import { Tank } from './tank.js';
import { Fish } from './fish.js';
import { UserFish } from './userfish.js';
let tank;
function setup() {
    createCanvas(1000, 800);
    // Initialize the tank
    tank = new Tank(150, 150, 700, 500, 400);
    // Load the fish spritesheet
    Fish.loadSpritesheet();
    // Add fish to the tank with random 3D positions and sizes
    for (let i = 0; i < 10; i++) {
        const x = random(150, 850); // Random x within the front pane bounds
        const y = random(150, 650); // Random y within the front pane bounds
        const z = random(0, 400); // Random depth (0 = front, 1 = back)
        const size = random(20, 30); // Random size for fish
        const fish = new Fish(x, y, z, size);
        tank.addFish(fish);
    }
    // Add the user-controlled fish
    let userFish = new UserFish(500, 400, 200, 30); // Start in the middle of the tank
    tank.addFish(userFish); // Add to the tank inhabitants
}
function draw() {
    background(255);
    // Update and render the tank
    tank.update();
    tank.render();
}
window.setup = setup;
window.draw = draw;
