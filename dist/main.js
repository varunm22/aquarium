import { Tank } from './tank.js';
import { EmberTetra } from './inhabitants/embertetra.js';
import { Snail } from './inhabitants/snail.js';
import { SidePane } from './sidepane.js';
import { getTankBounds } from './constants.js';
let tank;
let sidePane;
function setup() {
    createCanvas(1200, 800);
    tank = new Tank(75, 150, 700, 500, 400);
    sidePane = new SidePane(tank);
    EmberTetra.loadSpritesheet();
    Snail.loadSpritesheet();
    const bounds = getTankBounds();
    for (let i = 0; i < 10; i++) {
        const x = random(bounds.min.x, bounds.max.x);
        const y = random(bounds.min.y, bounds.max.y);
        const z = random(bounds.min.z, bounds.max.z);
        const size = random(20, 30);
        tank.addFish(new EmberTetra(x, y, z, size));
    }
    const snail = new Snail(28);
    snail.setTank(tank);
    tank.addFish(snail);
}
function draw() {
    background(255);
    tank.update();
    tank.render();
    sidePane.render(tank);
}
window.setup = setup;
window.draw = draw;
