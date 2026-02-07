import { TANK_CONSTANTS } from './constants.js';
import { Microfauna } from './inhabitants/microfauna.js';
import { Food } from './inhabitants/food.js';
import { Algae } from './inhabitants/algae.js';
import { Snail } from './inhabitants/snail.js';
import { Position } from './factors/position.js';
import { Vector } from './vector.js';
export class Tank {
    constructor(x, y, width, height, depth) {
        this.x = TANK_CONSTANTS.X;
        this.y = TANK_CONSTANTS.Y;
        this.width = TANK_CONSTANTS.WIDTH;
        this.height = TANK_CONSTANTS.HEIGHT;
        this.depth = TANK_CONSTANTS.DEPTH;
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
        this.microfauna = [];
        this.food = [];
        this.algae = new Algae();
        this.eggClumps = [];
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * this.width + this.x;
            const y = Math.random() * 100 + (this.waterLevelBottom - 100);
            const z = Math.random() * this.depth;
            const position = new Position(new Vector(x, y, z), new Vector(0, 0, 0));
            const microfauna = new Microfauna(position);
            microfauna.setTank(this);
            this.microfauna.push(microfauna);
        }
    }
    addFish(fish) { this.fish.push(fish); }
    addSnail(snail) { this.fish.push(snail); }
    removeSnail(snail) {
        const index = this.fish.indexOf(snail);
        if (index > -1)
            this.fish.splice(index, 1);
    }
    getSnails() {
        return this.fish.filter(fish => fish instanceof Snail);
    }
    addMicrofauna(microfauna) { this.microfauna.push(microfauna); }
    addFood(food) {
        food.setTank(this);
        this.food.push(food);
    }
    removeFood(food) {
        const index = this.food.indexOf(food);
        if (index > -1)
            this.food.splice(index, 1);
    }
    addEggClump(eggClump) {
        eggClump.setTank(this);
        this.eggClumps.push(eggClump);
    }
    removeEggClump(eggClump) {
        const index = this.eggClumps.indexOf(eggClump);
        if (index > -1)
            this.eggClumps.splice(index, 1);
    }
    dropFood(feedingX, feedingZ) {
        let x, z;
        if (feedingX !== undefined && feedingZ !== undefined) {
            x = Math.max(this.x, Math.min(this.x + this.width, feedingX + random(-50, 50)));
            z = Math.max(20, Math.min(this.depth, feedingZ + random(-50, 50)));
        }
        else {
            x = random(this.x, this.x + this.width);
            z = random(20, this.depth);
        }
        const y = this.y - random(20, 50);
        this.addFood(new Food(x, y, z));
    }
    update() {
        const allInhabitants = [...this.fish, ...this.microfauna];
        for (let fish of this.fish)
            fish.update(allInhabitants);
        for (let microfauna of this.microfauna)
            microfauna.update(allInhabitants);
        for (let eggClump of this.eggClumps)
            eggClump.update(allInhabitants);
        this.fish = this.fish.filter(f => !(f instanceof Snail && f.shouldBeRemoved()));
        this.eggClumps = this.eggClumps.filter(e => !e.shouldBeRemoved());
        for (let food of this.food)
            food.update();
        this.algae.update();
    }
    render() {
        this.fish.sort((a, b) => b.position.z - a.position.z);
        this.microfauna.sort((a, b) => b.position.z - a.position.z);
        this.food.sort((a, b) => b.position.z - a.position.z);
        this.eggClumps.sort((a, b) => b.position.z - a.position.z);
        this.renderBack();
        this.algae.render(this);
        this.renderGravel();
        const allInhabitants = [...this.fish, ...this.microfauna];
        allInhabitants.sort((a, b) => b.position.z - a.position.z);
        // Render objects behind the first water layer (at the absolute back)
        for (let i of allInhabitants) {
            if (i.position.z >= this.depth)
                i.render(this, color(0, 0, 0));
        }
        for (let f of this.food) {
            if (f.position.z >= this.depth)
                f.render(this);
        }
        for (let e of this.eggClumps) {
            if (e.position.z >= this.depth)
                e.render(this);
        }
        // Render water layers from back to front, interleaved with objects
        for (let i = this.numLayers - 1; i >= 0; i--) {
            const interp = i / this.numLayers;
            const nextInterp = (i + 1) / this.numLayers;
            const layerZStart = interp * this.depth;
            const layerZEnd = nextInterp * this.depth;
            for (let inh of allInhabitants) {
                if (inh.position.z >= layerZStart && inh.position.z < layerZEnd)
                    inh.render(this, color(0, 0, 0));
            }
            for (let f of this.food) {
                if (f.position.z >= layerZStart && f.position.z < layerZEnd)
                    f.render(this);
            }
            for (let e of this.eggClumps) {
                if (e.position.z >= layerZStart && e.position.z < layerZEnd)
                    e.render(this);
            }
            const layerX = lerp(this.x, this.backX, interp);
            const layerYTop = lerp(this.waterLevelTop, this.waterLevelTopBack, interp);
            const layerYBottom = lerp(this.waterLevelBottom, this.backY + this.backHeight, interp);
            const layerWidth = lerp(this.width, this.backWidth, interp);
            fill(173, 216, 230, map(i, 0, this.numLayers, 30, 0));
            noStroke();
            rect(layerX, layerYTop, layerWidth, layerYBottom - layerYTop);
        }
        // Render objects in front of the last water layer
        for (let i of allInhabitants) {
            if (i.position.z < 0)
                i.render(this, color(173, 216, 230));
        }
        for (let f of this.food) {
            if (f.position.z < 0)
                f.render(this);
        }
        for (let e of this.eggClumps) {
            if (e.position.z < 0)
                e.render(this);
        }
        this.algae.renderFrontWall(this);
        this.renderFront();
    }
    renderBack() {
        stroke(0);
        strokeWeight(10);
        line(this.backX, this.backY, this.backX + this.backWidth, this.backY);
        line(this.backX, this.backY + this.backHeight, this.backX + this.backWidth, this.backY + this.backHeight);
        strokeWeight(5);
        line(this.backX, this.backY, this.backX, this.backY + this.backHeight);
        line(this.backX + this.backWidth, this.backY, this.backX + this.backWidth, this.backY + this.backHeight);
        strokeWeight(5);
        line(this.x, this.y, this.backX, this.backY);
        line(this.x + this.width, this.y, this.backX + this.backWidth, this.backY);
        line(this.x, this.y + this.height, this.backX, this.backY + this.backHeight);
        line(this.x + this.width, this.y + this.height, this.backX + this.backWidth, this.backY + this.backHeight);
        strokeWeight(2);
        line(this.x, this.waterLevelTop, this.backX, this.waterLevelTopBack);
        line(this.x + this.width, this.waterLevelTop, this.backX + this.backWidth, this.waterLevelTopBack);
        line(this.backX, this.waterLevelTopBack, this.backX + this.backWidth, this.waterLevelTopBack);
    }
    renderFront() {
        stroke(0);
        strokeWeight(10);
        line(this.x, this.y, this.x + this.width, this.y);
        line(this.x, this.y + this.height, this.x + this.width, this.y + this.height);
        strokeWeight(5);
        line(this.x, this.y, this.x, this.y + this.height);
        line(this.x + this.width, this.y, this.x + this.width, this.y + this.height);
        strokeWeight(2);
        line(this.x, this.waterLevelTop, this.x + this.width, this.waterLevelTop);
    }
    /** Convert a 3D position to 2D render coordinates with perspective scaling */
    getRenderPosition(pos) {
        const relativeDepth = pos.z / this.depth;
        return {
            x: lerp(this.x, this.backX, relativeDepth) + (pos.x - this.x) * lerp(1, 0.7, relativeDepth),
            y: lerp(this.y, this.backY, relativeDepth) + (pos.y - this.y) * lerp(1, 0.667, relativeDepth),
            depthScale: lerp(1, 0.7, relativeDepth)
        };
    }
    renderGravel() {
        if (!this.gravelBottom || !this.gravelFront)
            return;
        push();
        const scale = this.width / 896;
        const scaledWidth = 896 * scale;
        const scaledHeight = 512 * scale;
        image(this.gravelBottom, this.x, this.waterLevelBottom - scaledHeight - TANK_CONSTANTS.GRAVEL_HEIGHT, scaledWidth, scaledHeight);
        image(this.gravelFront, this.x, this.waterLevelBottom - TANK_CONSTANTS.GRAVEL_HEIGHT, scaledWidth, TANK_CONSTANTS.GRAVEL_HEIGHT, 
        // @ts-ignore
        0, 0, 896, TANK_CONSTANTS.GRAVEL_HEIGHT / scale);
        pop();
    }
}
