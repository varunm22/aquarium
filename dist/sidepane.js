import { EmberTetra } from './inhabitants/embertetra.js';
import { UserFish } from './inhabitants/userfish.js';
import { Fish } from './inhabitants/fish.js';
import { getTankBounds } from './constants.js';
// p5.js constants
const CENTER = 'center';
const LEFT = 'left';
export class SidePane {
    constructor(tank) {
        this.selectedView = 'fish';
        this.headerHeight = 40;
        this.footerHeight = 40;
        this.mouseWasPressed = false;
        this.tabs = [
            { id: 'fish', label: 'fish' },
            { id: 'chem', label: 'chem' },
            { id: 'actions', label: 'actions' }
        ];
        this.tank = tank;
        this.x = tank.x + tank.width + 50; // 50px gap from tank
        this.y = tank.y;
        this.width = tank.width / 3;
        this.height = tank.height;
        this.rowHeight = 50;
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
    addNewFish() {
        const bounds = getTankBounds();
        const x = random(bounds.min.x, bounds.max.x);
        const y = -30; // Start above the tank
        const z = random(bounds.min.z, bounds.max.z);
        const size = random(20, 30);
        this.tank.addFish(new EmberTetra(x, y, z, size));
    }
    renderFooter() {
        const footerY = this.y + this.height - this.footerHeight;
        // Draw footer background
        fill(220, 240, 255); // Lighter water blue background
        stroke(150, 190, 210); // Darker water blue border
        strokeWeight(1);
        rect(this.x, footerY, this.width, this.footerHeight);
        // Add New button
        const buttonSize = 20;
        const buttonX = this.x + this.padding;
        const buttonY = footerY + (this.footerHeight - buttonSize) / 2;
        // Draw button
        fill(100, 200, 100); // Green
        stroke(50, 150, 50); // Darker green border
        strokeWeight(1);
        rect(buttonX, buttonY, buttonSize, buttonSize);
        // Draw plus sign
        fill(255, 255, 255);
        noStroke();
        textSize(12);
        textAlign(CENTER, CENTER);
        text('+', buttonX + buttonSize / 2, buttonY + buttonSize / 2);
        // Draw text
        fill(0, 0, 0);
        textAlign(LEFT, CENTER);
        text('Add New', buttonX + buttonSize + 10, buttonY + buttonSize / 2);
        // Handle click release
        if (this.mouseWasPressed && !mouseIsPressed) {
            if (mouseX >= buttonX && mouseX <= buttonX + buttonSize &&
                mouseY >= buttonY && mouseY <= buttonY + buttonSize) {
                this.addNewFish();
            }
        }
    }
    render(tank) {
        // Draw the side pane background
        fill(220, 240, 255);
        stroke(150, 190, 210);
        strokeWeight(1);
        rect(this.x, this.y, this.width, this.height);
        // Draw the content first
        if (this.selectedView === 'fish') {
            this.renderFishView(tank);
        }
        else if (this.selectedView === 'chem') {
            this.renderChemView();
        }
        else if (this.selectedView === 'actions') {
            this.renderActionsView();
        }
        // Draw the masking frame
        this.drawMaskingFrame(tank);
        // Reset fill and stroke for header
        fill(220, 240, 255);
        stroke(150, 190, 210);
        strokeWeight(1);
        // Draw the sticky header last (on top of everything)
        this.renderHeader();
        // Draw the footer
        this.renderFooter();
        // Update mouse state for next frame
        this.mouseWasPressed = mouseIsPressed;
    }
    renderHeader() {
        const tabWidth = this.width / this.tabs.length;
        this.tabs.forEach((tab, index) => {
            const tabX = this.x + (index * tabWidth);
            const isSelected = this.selectedView === tab.id;
            // Draw tab background
            fill(isSelected ? 220 : 180, isSelected ? 240 : 200, isSelected ? 255 : 220);
            stroke(150, 190, 210);
            strokeWeight(1);
            // Draw tab with background
            if (isSelected) {
                // Draw rectangle for the background first
                rect(tabX, this.y, tabWidth, this.headerHeight);
                // Now draw the lines (except bottom) to create the tab effect
                stroke(150, 190, 210);
                strokeWeight(1);
                line(tabX, this.y, tabX + tabWidth, this.y); // Top
                line(tabX, this.y, tabX, this.y + this.headerHeight); // Left
                line(tabX + tabWidth, this.y, tabX + tabWidth, this.y + this.headerHeight); // Right
                // Draw a line at the bottom with the same color as the background to "erase" the bottom border
                stroke(220, 240, 255);
                strokeWeight(2); // Slightly thicker to fully cover the existing border
                line(tabX + 1, this.y + this.headerHeight, tabX + tabWidth - 1, this.y + this.headerHeight);
            }
            else {
                // Unselected tab: draw all borders with background
                rect(tabX, this.y, tabWidth, this.headerHeight);
            }
            // Draw tab text
            fill(0, 0, 0);
            textSize(12);
            textAlign(CENTER, CENTER);
            text(tab.label, tabX + tabWidth / 2, this.y + this.headerHeight / 2);
        });
        // Handle tab clicks
        if (this.mouseWasPressed && !mouseIsPressed) {
            const clickedTabIndex = Math.floor((mouseX - this.x) / tabWidth);
            if (clickedTabIndex >= 0 && clickedTabIndex < this.tabs.length &&
                mouseY >= this.y && mouseY <= this.y + this.headerHeight) {
                this.selectedView = this.tabs[clickedTabIndex].id;
            }
        }
    }
    renderFishView(tank) {
        // Calculate max scroll based on number of fish and visible rows
        const regularFish = tank.fish
            .filter(fish => fish instanceof EmberTetra && !(fish instanceof UserFish))
            .sort((a, b) => a.id.localeCompare(b.id)); // Sort by ID
        const totalHeight = regularFish.length * this.rowHeight;
        const visibleRows = Math.floor((this.height - this.headerHeight - this.footerHeight) / this.rowHeight);
        this.maxScroll = Math.max(0, totalHeight - visibleRows * this.rowHeight);
        // Calculate which rows to show
        const startRow = Math.floor(this.scrollOffset / this.rowHeight);
        const endRow = Math.min(regularFish.length, startRow + Math.ceil(this.height / this.rowHeight) + 1);
        // Draw all potentially visible fish rows
        for (let i = startRow; i < endRow; i++) {
            if (i >= 0 && i < regularFish.length) {
                const rowY = this.y + this.headerHeight + (i * this.rowHeight) - this.scrollOffset;
                // Draw row separator
                stroke(150, 190, 210);
                strokeWeight(1);
                line(this.x, rowY + this.rowHeight, this.x + this.width, rowY + this.rowHeight);
                this.renderFishInfo(regularFish[i], rowY);
            }
        }
    }
    renderChemView() {
        const rowY = this.y + this.headerHeight;
        fill(0, 0, 0);
        textSize(12);
        textAlign(LEFT, CENTER);
        text('Coming soon', this.x + this.padding, rowY + this.rowHeight / 2);
    }
    renderActionsView() {
        const buttonY = this.y + this.headerHeight + this.padding;
        const buttonWidth = this.width - (this.padding * 2);
        const buttonHeight = 40;
        // Draw feed button
        fill(100, 150, 255); // Blue
        stroke(50, 100, 200); // Darker blue border
        strokeWeight(1);
        rect(this.x + this.padding, buttonY, buttonWidth, buttonHeight);
        // Draw button text
        fill(255, 255, 255); // White text
        noStroke();
        textSize(14);
        textAlign(CENTER, CENTER);
        text('Feed', this.x + this.padding + buttonWidth / 2, buttonY + buttonHeight / 2);
        // Handle feed button click
        if (this.mouseWasPressed && !mouseIsPressed) {
            if (mouseX >= this.x + this.padding && mouseX <= this.x + this.padding + buttonWidth &&
                mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
                this.handleFeedAction();
            }
        }
    }
    handleFeedAction() {
        // Drop 3-5 food particles when feeding
        const numPellets = Math.floor(Math.random() * 3) + 3; // 3-5 pellets
        for (let i = 0; i < numPellets; i++) {
            // Stagger the drops slightly for a more natural look
            setTimeout(() => {
                this.tank.dropFood();
            }, i * 100); // 100ms delay between each pellet
        }
        console.log(`Dropped ${numPellets} food pellets!`);
    }
    drawMaskingFrame(tank) {
        push();
        fill(255, 255, 255);
        noStroke();
        // Create three rectangles to mask overflow on top, bottom, and right sides
        const headerBottom = this.y + this.headerHeight;
        rect(this.x - 10, this.y - 20, this.width + 20, headerBottom - this.y + 20);
        rect(this.x - 10, this.y + this.height, this.width + 20, tank.height + 100);
        rect(this.x + this.width, 0, 500, tank.height + 100);
        // Redraw the pane border which was covered by our masks
        stroke(150, 190, 210);
        strokeWeight(1);
        noFill();
        rect(this.x, this.y, this.width, this.height);
        pop();
    }
    renderFishInfo(fish, y) {
        // Draw fish sprite
        if (fish instanceof EmberTetra && EmberTetra.spritesheet) {
            // Get the same sprite index as the fish's current orientation
            const { index, mirrored } = fish.getSpriteInfo();
            // Ensure index is within bounds
            if (index >= 0 && index < EmberTetra.SPRITE_CONFIGS.length) {
                const spriteConfig = EmberTetra.SPRITE_CONFIGS[index];
                const scale = 0.5; // Scale down the sprite
                const spriteWidth = spriteConfig.width * scale;
                const spriteHeight = spriteConfig.height * scale;
                // Calculate sprite position
                const spriteX = this.x + this.padding;
                const spriteY = y + (this.rowHeight - spriteHeight) / 2;
                // Draw the sprite
                image(EmberTetra.spritesheet, mirrored ? spriteX + spriteWidth : spriteX, // Flip x position if mirrored
                spriteY, mirrored ? -spriteWidth : spriteWidth, // Flip width if mirrored
                spriteHeight, spriteConfig.x, spriteConfig.y, spriteConfig.width, spriteConfig.height);
            }
        }
        // Draw fish information
        push();
        textSize(12);
        fill(0, 0, 0); // Black text
        noStroke();
        textAlign(LEFT, CENTER);
        const infoX = this.x + this.padding + 50; // Start after the sprite
        const infoY = y + this.rowHeight / 2;
        // Only show fear and hunger for Fish instances
        if (fish instanceof Fish) {
            // Fear information
            const fearValue = Math.round(fish.getFearValue() * 100);
            const scaredStatus = fish.getFearValue() > 0.5 ? ' - scared' : '';
            text(`Fear: ${fearValue}%${scaredStatus}`, infoX, infoY - 9);
            // Hunger information
            const hungerValue = Math.round(fish.getHungerValue() * 100);
            const feedingStatus = fish.isInFeedingMode() ? ' - feeding' : '';
            text(`Hunger: ${hungerValue}%${feedingStatus}`, infoX, infoY + 9);
        }
        pop();
        // Add delete button
        const deleteButtonSize = 16;
        const deleteButtonX = this.x + this.width - deleteButtonSize - this.padding;
        const deleteButtonY = y + (this.rowHeight - deleteButtonSize) / 2;
        // Draw delete button
        fill(255, 200, 200); // Light red
        stroke(200, 100, 100); // Darker red border
        strokeWeight(1);
        rect(deleteButtonX, deleteButtonY, deleteButtonSize, deleteButtonSize);
        // Draw X in delete button
        fill(200, 50, 50); // Darker red X
        noStroke();
        textSize(10);
        textAlign(CENTER, CENTER);
        text('×', deleteButtonX + deleteButtonSize / 2, deleteButtonY + deleteButtonSize / 2);
        // Handle delete button click release
        if (this.mouseWasPressed && !mouseIsPressed) {
            if (mouseX >= deleteButtonX && mouseX <= deleteButtonX + deleteButtonSize &&
                mouseY >= deleteButtonY && mouseY <= deleteButtonY + deleteButtonSize) {
                const index = this.tank.fish.indexOf(fish);
                if (index > -1) {
                    this.tank.fish.splice(index, 1);
                }
            }
        }
    }
}
