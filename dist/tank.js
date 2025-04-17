export class Tank {
    constructor(x, y, width, height, depth) {
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
}
