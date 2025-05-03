import { Fish } from './fish.js';
import { UserFish } from './userfish.js';
export class SidePane {
    constructor(tank) {
        this.selectedView = 'fish';
        this.x = tank.x + tank.width + 50; // 50px gap from tank
        this.y = tank.y;
        this.width = tank.width / 3;
        this.height = tank.height;
        this.rowHeight = 60; // Height for each fish row
        this.padding = 10;
        this.scrollOffset = 0;
        this.maxScroll = 0;
        // Add mouse wheel event listener with non-passive option
        window.addEventListener('wheel', (event) => this.handleScroll(event), { passive: false });
    }
    handleScroll(event) {
        // Only handle scroll if mouse is over the side pane and fish view is selected
        if (event.clientX >= this.x && event.clientX <= this.x + this.width &&
            event.clientY >= this.y + this.rowHeight && event.clientY <= this.y + this.height &&
            this.selectedView === 'fish') {
            const newOffset = this.scrollOffset + event.deltaY;
            this.scrollOffset = Math.max(0, Math.min(this.maxScroll, newOffset));
            event.preventDefault();
        }
    }
    render(tank) {
        // Draw the side pane background
        fill(240, 240, 240);
        stroke(200, 200, 200);
        strokeWeight(1);
        rect(this.x, this.y, this.width, this.height);
        // Draw the sticky header
        this.renderHeader();
        if (this.selectedView === 'fish') {
            this.renderFishView(tank);
        }
        else {
            this.renderChemView();
        }
    }
    renderHeader() {
        const buttonWidth = 60;
        const buttonHeight = 30;
        const buttonY = this.y + this.padding;
        // Fish button
        const fishButtonX = this.x + this.padding;
        fill(this.selectedView === 'fish' ? 200 : 220);
        rect(fishButtonX, buttonY, buttonWidth, buttonHeight);
        fill(0);
        textSize(12);
        textAlign(0.5, 0.5);
        text('fish', fishButtonX + buttonWidth / 2, buttonY + buttonHeight / 2);
        // Chem button
        const chemButtonX = fishButtonX + buttonWidth + this.padding;
        fill(this.selectedView === 'chem' ? 200 : 220);
        rect(chemButtonX, buttonY, buttonWidth, buttonHeight);
        fill(0);
        text('chem', chemButtonX + buttonWidth / 2, buttonY + buttonHeight / 2);
        // Add click handlers
        if (mouseIsPressed()) {
            const mx = mouseX();
            const my = mouseY();
            if (mx >= fishButtonX && mx <= fishButtonX + buttonWidth &&
                my >= buttonY && my <= buttonY + buttonHeight) {
                this.selectedView = 'fish';
            }
            else if (mx >= chemButtonX && mx <= chemButtonX + buttonWidth &&
                my >= buttonY && my <= buttonY + buttonHeight) {
                this.selectedView = 'chem';
            }
        }
    }
    renderFishView(tank) {
        // Calculate max scroll based on number of fish and visible rows
        const regularFish = tank.fish.filter(fish => fish instanceof Fish && !(fish instanceof UserFish));
        const totalHeight = regularFish.length * this.rowHeight;
        const visibleRows = Math.floor((this.height - this.rowHeight) / this.rowHeight);
        this.maxScroll = Math.max(0, totalHeight - visibleRows * this.rowHeight);
        // Calculate which rows to show
        const startRow = Math.floor(this.scrollOffset / this.rowHeight);
        const endRow = Math.min(regularFish.length, startRow + Math.ceil(this.height / this.rowHeight) + 1);
        // Draw all potentially visible fish rows
        for (let i = startRow; i < endRow; i++) {
            if (i >= 0 && i < regularFish.length) {
                const rowY = this.y + this.rowHeight + this.padding + (i * this.rowHeight) - this.scrollOffset;
                this.renderFishInfo(regularFish[i], rowY);
            }
        }
    }
    renderChemView() {
        const rowY = this.y + this.rowHeight + this.padding;
        fill(0);
        textSize(12);
        textAlign(0, 0.5);
        text('Coming soon', this.x + this.padding, rowY + this.rowHeight / 2);
    }
    drawMaskingFrame(tank) {
        // Save current settings
        push();
        // Set fill and stroke properties for masking frame
        fill(255, 255, 255); // White fill to match background
        noStroke(); // No stroke for cleaner masking
        // Create four rectangles to mask overflow on all sides
        // Top mask (extends above the pane)
        rect(this.x - 10, 0, this.width + 20, this.y);
        // Bottom mask (extends below the pane)
        rect(this.x - 10, this.y + this.height, this.width + 20, tank.height + 100);
        // Left mask (covers area left of the pane)
        rect(tank.x + tank.width, 0, this.x - (tank.x + tank.width), tank.height + 100);
        // Right mask (covers area right of the pane)
        rect(this.x + this.width, 0, 500, tank.height + 100); // Using 500 as a safe width
        // Redraw the pane border which was covered by our masks
        stroke(200, 200, 200);
        strokeWeight(1);
        noFill();
        rect(this.x, this.y, this.width, this.height);
        // Restore previous settings
        pop();
    }
    renderFishInfo(fish, y) {
        // Draw fish sprite
        if (fish instanceof Fish && Fish.spritesheet) {
            // Get the same sprite index as the fish's current orientation
            const { index, mirrored } = fish.getSpriteIndex();
            // Ensure index is within bounds
            if (index >= 0 && index < Fish.SPRITE_CONFIGS.length) {
                const spriteConfig = Fish.SPRITE_CONFIGS[index];
                const scale = 0.5; // Scale down the sprite
                const spriteWidth = spriteConfig.width * scale;
                const spriteHeight = spriteConfig.height * scale;
                // Calculate sprite position
                const spriteX = this.x + this.padding;
                const spriteY = y + (this.rowHeight - spriteHeight) / 2;
                // Draw the sprite
                image(Fish.spritesheet, mirrored ? spriteX + spriteWidth : spriteX, // Flip x position if mirrored
                spriteY, mirrored ? -spriteWidth : spriteWidth, // Flip width if mirrored
                spriteHeight, spriteConfig.x, spriteConfig.y, spriteConfig.width, spriteConfig.height);
            }
        }
        // Draw fish information
        push();
        textSize(12);
        fill(0, 0, 0); // Black text
        noStroke();
        const infoX = this.x + this.padding + 50; // Start after the sprite
        const infoY = y + this.rowHeight / 2;
        // Position information
        text(`Position: (${Math.round(fish.position.x)}, ${Math.round(fish.position.y)}, ${Math.round(fish.position.z)})`, infoX, infoY - 10);
        // Size information
        text(`Size: ${Math.round(fish.size)}`, infoX, infoY + 10);
        pop();
    }
}
