import { Tank } from './tank.js';
import { Inhabitant } from './inhabitant.js';
import { Fish } from './fish.js';
import { UserFish } from './userfish.js';

// Declare p5.js global functions
declare function fill(r: number, g: number, b: number): void;
declare function stroke(r: number, g: number, b: number): void;
declare function strokeWeight(weight: number): void;
declare function rect(x: number, y: number, w: number, h: number): void;
declare function line(x1: number, y1: number, x2: number, y2: number): void;
declare function text(str: string, x: number, y: number, x2?: number, y2?: number): void;
declare function textSize(size: number): void;
declare function textAlign(alignX: string, alignY?: string): void;
declare function image(img: p5.Image, x: number, y: number, w: number, h: number, sx: number, sy: number, sw: number, sh: number): void;
declare function noStroke(): void;
declare function noFill(): void;
declare function push(): void;
declare function pop(): void;
declare const mouseIsPressed: boolean;
declare const mouseX: number;
declare const mouseY: number;

// p5.js constants
const CENTER = 'center';
const LEFT = 'left';

// Declare p5 namespace
declare namespace p5 {
    interface Image {}
}

export class SidePane {
    private x: number;
    private y: number;
    private width: number;
    private height: number;
    private rowHeight: number;
    private padding: number;
    private scrollOffset: number;
    private maxScroll: number;
    private selectedView: 'fish' | 'chem' = 'fish';

    constructor(tank: Tank) {
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

    private handleScroll(event: WheelEvent): void {
        // Only handle scroll if mouse is over the side pane and fish view is selected
        if (event.clientX >= this.x && event.clientX <= this.x + this.width &&
            event.clientY >= this.y + this.rowHeight && event.clientY <= this.y + this.height &&
            this.selectedView === 'fish') {
            const newOffset = this.scrollOffset + event.deltaY;
            this.scrollOffset = Math.max(0, Math.min(this.maxScroll, newOffset));
            event.preventDefault();
        }
    }

    render(tank: Tank): void {
        // Draw the side pane background
        fill(220, 240, 255); // Lighter water blue background
        stroke(150, 190, 210); // Darker water blue border
        strokeWeight(1);
        rect(this.x, this.y, this.width, this.height);

        // Draw the content first
        if (this.selectedView === 'fish') {
            this.renderFishView(tank);
        } else {
            this.renderChemView();
        }

        // Draw the masking frame
        this.drawMaskingFrame(tank);

        // Draw the sticky header last (on top of everything)
        this.renderHeader();
    }

    private renderHeader(): void {
        const buttonWidth = 60;
        const buttonHeight = 40; // Increased height for equal padding
        const buttonY = this.y + (this.rowHeight - buttonHeight) / 2; // Center vertically in header
        
        // Draw header background with border
        fill(220, 240, 255); // Lighter water blue background
        stroke(150, 190, 210); // Darker water blue border
        strokeWeight(1);
        rect(this.x, this.y, this.width, this.rowHeight);
        
        // Fish button
        const fishButtonX = this.x + this.padding;
        fill(200, 220, 240); // Unselected water blue
        if (this.selectedView === 'fish') fill(180, 200, 220); // Selected water blue
        stroke(150, 190, 210); // Darker water blue border
        strokeWeight(1);
        rect(fishButtonX, buttonY, buttonWidth, buttonHeight);
        fill(0, 0, 0);
        textSize(12);
        textAlign(CENTER, CENTER);
        text('fish', fishButtonX + buttonWidth/2, buttonY + buttonHeight/2);

        // Chem button
        const chemButtonX = fishButtonX + buttonWidth + this.padding;
        fill(200, 220, 240); // Unselected water blue
        if (this.selectedView === 'chem') fill(180, 200, 220); // Selected water blue
        stroke(150, 190, 210); // Darker water blue border
        strokeWeight(1);
        rect(chemButtonX, buttonY, buttonWidth, buttonHeight);
        fill(0, 0, 0);
        text('chem', chemButtonX + buttonWidth/2, buttonY + buttonHeight/2);

        // Add click handlers
        if (mouseIsPressed) {
            if (mouseX >= fishButtonX && mouseX <= fishButtonX + buttonWidth &&
                mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
                this.selectedView = 'fish';
            } else if (mouseX >= chemButtonX && mouseX <= chemButtonX + buttonWidth &&
                       mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
                this.selectedView = 'chem';
            }
        }
    }

    private renderFishView(tank: Tank): void {
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
                
                // Draw row separator
                stroke(150, 190, 210); // Darker water blue separator
                strokeWeight(1);
                line(this.x, rowY + this.rowHeight, this.x + this.width, rowY + this.rowHeight);
                
                this.renderFishInfo(regularFish[i], rowY);
            }
        }
    }

    private renderChemView(): void {
        const rowY = this.y + this.rowHeight + this.padding;
        fill(0, 0, 0);
        textSize(12);
        textAlign(LEFT, CENTER);
        text('Coming soon', this.x + this.padding, rowY + this.rowHeight/2);
    }

    private drawMaskingFrame(tank: Tank): void {
        // Save current settings
        push();
        
        // Set fill and stroke properties for masking frame
        fill(255, 255, 255); // White fill to match background
        noStroke(); // No stroke for cleaner masking
        
        // Create three rectangles to mask overflow on top, bottom, and right sides
        
        // Top mask (starts below the selector buttons)
        const selectorBottom = this.y + this.rowHeight;
        rect(this.x - 10, selectorBottom, this.width + 20, this.y - selectorBottom);
        
        // Bottom mask (extends below the pane)
        rect(this.x - 10, this.y + this.height, this.width + 20, tank.height + 100);
        
        // Right mask (covers area right of the pane)
        rect(this.x + this.width, 0, 500, tank.height + 100); // Using 500 as a safe width
        
        // Redraw the pane border which was covered by our masks
        stroke(150, 190, 210); // Darker water blue border
        strokeWeight(1);
        noFill();
        rect(this.x, this.y, this.width, this.height);
        
        // Restore previous settings
        pop();
    }

    private renderFishInfo(fish: Inhabitant, y: number): void {
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
                image(
                    Fish.spritesheet,
                    mirrored ? spriteX + spriteWidth : spriteX, // Flip x position if mirrored
                    spriteY,
                    mirrored ? -spriteWidth : spriteWidth, // Flip width if mirrored
                    spriteHeight,
                    spriteConfig.x,
                    spriteConfig.y,
                    spriteConfig.width,
                    spriteConfig.height
                );
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
        
        // Position information
        text(`Position: (${Math.round(fish.position.x)}, ${Math.round(fish.position.y)}, ${Math.round(fish.position.z)})`, 
            infoX, infoY - 10);
        
        // Size information
        text(`Size: ${Math.round(fish.size)}`, infoX, infoY + 10);
        pop();
    }
} 