import { TANK_CONSTANTS } from './constants.js';
import { Microfauna } from './inhabitants/microfauna.js';
import { Position } from './factors/position.js';
import { Vector } from './vector.js';
export class Tank {
    constructor(x, y, width, height, depth) {
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
        this.microfauna = [];
        // Initialize 10 microfauna in random positions in bottom 100 pixels
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * this.width + this.x;
            const y = Math.random() * 100 + (this.waterLevelBottom - 100); // Random position in bottom 100 pixels
            const z = Math.random() * this.depth;
            const position = new Position(new Vector(x, y, z), new Vector(0, 0, 0));
            const microfauna = new Microfauna(position);
            microfauna.setTank(this);
            this.microfauna.push(microfauna);
        }
    }
    addFish(fish) {
        this.fish.push(fish);
    }
    addMicrofauna(microfauna) {
        this.microfauna.push(microfauna);
    }
    update() {
        // Combine all inhabitants for updates
        const allInhabitants = [...this.fish, ...this.microfauna];
        // Update all fish in the tank
        for (let fish of this.fish) {
            fish.update(allInhabitants);
        }
        // Update all microfauna
        for (let micro of this.microfauna) {
            micro.update(allInhabitants);
        }
    }
    render() {
        // Sort fish by depth (further fish first)
        this.fish.sort((a, b) => b.position.z - a.position.z);
        // Sort microfauna by depth
        this.microfauna.sort((a, b) => b.position.z - a.position.z);
        // Render back pane (before any water layers)
        this.renderBack();
        // Render gravel
        this.renderGravel();
        // Combine fish and microfauna for rendering
        const allInhabitants = [...this.fish, ...this.microfauna];
        allInhabitants.sort((a, b) => b.position.z - a.position.z);
        // Render inhabitants behind the first water layer (z > this.depth, at the absolute back)
        for (let inhabitant of allInhabitants) {
            if (inhabitant.position.z >= this.depth) {
                inhabitant.render(this, color(0, 0, 0));
            }
        }
        // Render water layers from back to front
        for (let i = this.numLayers - 1; i >= 0; i--) {
            const interp = i / this.numLayers;
            const nextInterp = (i + 1) / this.numLayers;
            const layerZStart = interp * this.depth;
            const layerZEnd = nextInterp * this.depth;
            // Render inhabitants that fall within this layer
            for (let inhabitant of allInhabitants) {
                if (inhabitant.position.z >= layerZStart && inhabitant.position.z < layerZEnd) {
                    inhabitant.render(this, color(0, 0, 0));
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
        // Render inhabitants in front of the last water layer (z < 0, at the absolute front)
        for (let inhabitant of allInhabitants) {
            if (inhabitant.position.z < 0) {
                inhabitant.render(this, color(173, 216, 230));
            }
        }
        // Render front pane (after all water layers and inhabitants)
        this.renderFront();
    }
    renderBack() {
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
    renderFront() {
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
    renderGravel() {
        // Skip if texture isn't loaded yet
        if (!this.gravelBottom || !this.gravelFront)
            return;
        push();
        // Calculate scaling factor based on tank width
        const scale = this.width / 896; // scale to fit tank width
        const scaledWidth = 896 * scale;
        const scaledHeight = 512 * scale;
        // Position the image:
        // x: align with tank left edge
        // y: align bottom of image with bottom of tank
        image(this.gravelBottom, this.x, // left align with tank
        this.waterLevelBottom - scaledHeight - TANK_CONSTANTS.GRAVEL_HEIGHT, // bottom align with tank
        scaledWidth, scaledHeight);
        image(this.gravelFront, this.x, this.waterLevelBottom - TANK_CONSTANTS.GRAVEL_HEIGHT, scaledWidth, TANK_CONSTANTS.GRAVEL_HEIGHT, 
        // @ts-ignore
        0, 0, 896, TANK_CONSTANTS.GRAVEL_HEIGHT / scale);
        pop();
    }
}
