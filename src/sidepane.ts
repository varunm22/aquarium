import { Tank } from './tank.js';
import { Inhabitant } from './inhabitants/inhabitant.js';
import { EmberTetra } from './inhabitants/embertetra.js';
import { UserFish } from './inhabitants/userfish.js';
import { Fish } from './inhabitants/fish.js';
import { Snail } from './inhabitants/snail_new.js';
import { getTankBounds } from './constants.js';

// Declare p5.js global functions
declare function fill(r: number, g: number, b: number, a?: number): void;
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
declare function translate(x: number, y: number): void;
declare function rotate(angle: number): void;
declare function scale(x: number, y: number): void;
declare const mouseIsPressed: boolean;
declare const mouseX: number;
declare const mouseY: number;
declare function random(min: number, max: number): number;

// p5.js constants
const CENTER = 'center';
const LEFT = 'left';
const RIGHT = 'right';

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
    private selectedView: 'fish' | 'chem' | 'actions' = 'fish';
    private tank: Tank;
    private headerHeight: number = 40;
    private footerHeight: number = 40;
    private mouseWasPressed: boolean = false;
    private readonly tabs: { id: 'fish' | 'chem' | 'actions', label: string }[] = [
        { id: 'fish', label: 'fish' },
        { id: 'chem', label: 'chem' },
        { id: 'actions', label: 'actions' }
    ];
    
    // New state for fish view modes
    private fishViewMode: 'species' | 'individuals' = 'species';
    private selectedSpecies: 'embertetra' | 'snail' | null = null;

    constructor(tank: Tank) {
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

    private handleScroll(event: WheelEvent): void {
        // Only handle scroll if mouse is over the side pane and fish view is selected
        const hasFooter = this.selectedView === 'fish' && this.fishViewMode === 'individuals';
        const footerOffset = hasFooter ? this.footerHeight : 0;
        
        if (event.clientX >= this.x && event.clientX <= this.x + this.width &&
            event.clientY >= this.y + this.headerHeight && event.clientY <= this.y + this.height - footerOffset &&
            this.selectedView === 'fish') {
            const newOffset = this.scrollOffset + event.deltaY;
            this.scrollOffset = Math.max(0, Math.min(this.maxScroll, newOffset));
            event.preventDefault();
        }
    }


    private addNewFish(): void {
        // Check if we're in snail view and add appropriate creature
        if (this.selectedView === 'fish' && this.fishViewMode === 'individuals' && this.selectedSpecies === 'snail') {
            // Add a new snail
            const snail = new Snail(20); // Default size for snails
            this.tank.addFish(snail);
        } else {
            // Add a new fish (default behavior)
            const bounds = getTankBounds();
            const x = random(bounds.min.x, bounds.max.x);
            const y = -30; // Start above the tank
            const z = random(bounds.min.z, bounds.max.z);
            const size = random(20, 30);
            this.tank.addFish(new EmberTetra(x, y, z, size));
        }
    }

    private renderFooter(): void {
        const footerY = this.y + this.height - this.footerHeight;
        
        if (this.selectedView === 'fish' && this.fishViewMode === 'individuals') {
            // Show footer with both buttons when in individuals view
            fill(220, 240, 255); // Lighter water blue background
            stroke(150, 190, 210); // Darker water blue border
            strokeWeight(1);
            rect(this.x, footerY, this.width, this.footerHeight);
            
            this.renderBackButton(footerY);
            this.renderAddNewButton(footerY);
        }
        // No footer for species view, chem tab, or actions tab
    }

    private renderBackButton(footerY: number): void {
        const buttonSize = 20;
        const buttonX = this.x + this.padding;
        const buttonY = footerY + (this.footerHeight - buttonSize) / 2;

        // Draw button
        fill(200, 200, 200); // Gray
        stroke(150, 150, 150); // Darker gray border
        strokeWeight(1);
        rect(buttonX, buttonY, buttonSize, buttonSize);

        // Draw back arrow
        fill(100, 100, 100);
        noStroke();
        textSize(12);
        textAlign(CENTER, CENTER);
        text('←', buttonX + buttonSize/2, buttonY + buttonSize/2);

        // Draw text
        fill(0, 0, 0);
        textAlign(LEFT, CENTER);
        text('Back', buttonX + buttonSize + 10, buttonY + buttonSize/2);

        // Handle click release - make sure we're only checking the exact button area
        if (this.mouseWasPressed && !mouseIsPressed) {
            const clickX = mouseX;
            const clickY = mouseY;
            // Only check if click is within the left half of the footer
            if (clickX >= buttonX && clickX <= buttonX + buttonSize &&
                clickY >= buttonY && clickY <= buttonY + buttonSize &&
                clickX <= this.x + this.width / 2) { // Ensure click is in left half
                console.log('Back button clicked');
                this.fishViewMode = 'species';
                this.selectedSpecies = null;
                this.scrollOffset = 0; // Reset scroll when going back
            }
        }
    }

    private renderAddNewButton(footerY: number): void {
        const buttonSize = 20;
        const buttonY = footerY + (this.footerHeight - buttonSize) / 2;
        
        // Position button on right side if in individuals view, left side otherwise
        const isIndividualsView = this.selectedView === 'fish' && this.fishViewMode === 'individuals';
        const buttonX = isIndividualsView 
            ? this.x + this.width - buttonSize - this.padding - 10 // Extra spacing from edge
            : this.x + this.padding;

        // Draw text first (for individuals view, show text to the left of button)
        if (isIndividualsView) {
            fill(0, 0, 0);
            textAlign(RIGHT, CENTER);
            // Show appropriate text based on selected species
            const buttonText = this.selectedSpecies === 'snail' ? 'Add Snail' : 'Add Fish';
            text(buttonText, buttonX - 15, buttonY + buttonSize/2);
        }

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
        text('+', buttonX + buttonSize/2, buttonY + buttonSize/2);

        // Draw text - only show text if not in individuals view (to save space)
        if (!isIndividualsView) {
            fill(0, 0, 0);
            textAlign(LEFT, CENTER);
            text('Add New', buttonX + buttonSize + 10, buttonY + buttonSize/2);
        }

        // Handle click release - make sure we're only checking the exact button area
        if (this.mouseWasPressed && !mouseIsPressed) {
            const clickX = mouseX;
            const clickY = mouseY;
            // Only check if click is within the right half of the footer
            if (clickX >= buttonX && clickX <= buttonX + buttonSize &&
                clickY >= buttonY && clickY <= buttonY + buttonSize &&
                clickX >= this.x + this.width / 2) { // Ensure click is in right half
                console.log('Add New button clicked');
                this.addNewFish();
            }
        }
    }

    render(tank: Tank): void {
        // Draw the side pane background
        fill(220, 240, 255);
        stroke(150, 190, 210);
        strokeWeight(1);
        rect(this.x, this.y, this.width, this.height);

        // Draw the content first
        if (this.selectedView === 'fish') {
            this.renderFishView(tank);
        } else if (this.selectedView === 'chem') {
            this.renderChemView();
        } else if (this.selectedView === 'actions') {
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

    private renderHeader(): void {
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
            } else {
                // Unselected tab: draw all borders with background
                rect(tabX, this.y, tabWidth, this.headerHeight);
            }
            
            // Draw tab text
            fill(0, 0, 0);
            textSize(12);
            textAlign(CENTER, CENTER);
            text(tab.label, tabX + tabWidth/2, this.y + this.headerHeight/2);
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

    private renderFishView(tank: Tank): void {
        if (this.fishViewMode === 'species') {
            this.renderSpeciesView(tank);
        } else {
            this.renderIndividualsView(tank);
        }
    }

    private renderSpeciesView(tank: Tank): void {
        // Get counts for each species
        const emberTetraCount = tank.fish.filter(fish => fish instanceof EmberTetra && !(fish instanceof UserFish)).length;
        const snailCount = tank.getSnails().length;
        
        const species = [
            { type: 'embertetra' as const, count: emberTetraCount, label: 'Ember Tetras' },
            { type: 'snail' as const, count: snailCount, label: 'Snails' }
        ];

        // Calculate max scroll - no footer in species view
        const totalHeight = species.length * this.rowHeight;
        const visibleRows = Math.floor((this.height - this.headerHeight) / this.rowHeight);
        this.maxScroll = Math.max(0, totalHeight - visibleRows * this.rowHeight);

        // Calculate which rows to show
        const startRow = Math.floor(this.scrollOffset / this.rowHeight);
        const endRow = Math.min(species.length, startRow + Math.ceil(this.height / this.rowHeight) + 1);

        // Draw species rows
        for (let i = startRow; i < endRow; i++) {
            if (i >= 0 && i < species.length) {
                const rowY = this.y + this.headerHeight + (i * this.rowHeight) - this.scrollOffset;
                
                // Draw row separator
                stroke(150, 190, 210);
                strokeWeight(1);
                line(this.x, rowY + this.rowHeight, this.x + this.width, rowY + this.rowHeight);
                
                this.renderSpeciesInfo(species[i], rowY);
            }
        }
    }

    private renderIndividualsView(tank: Tank): void {
        if (!this.selectedSpecies) return;

        // Filter inhabitants based on selected species
        let inhabitants: Inhabitant[] = [];
        if (this.selectedSpecies === 'embertetra') {
            inhabitants = tank.fish
                .filter(fish => fish instanceof EmberTetra && !(fish instanceof UserFish))
                .sort((a, b) => (a as Fish).id.localeCompare((b as Fish).id));
        } else if (this.selectedSpecies === 'snail') {
            inhabitants = tank.getSnails()
                .sort((a, b) => a.id.localeCompare(b.id));
        }

        // Calculate max scroll
        const totalHeight = inhabitants.length * this.rowHeight;
        const visibleRows = Math.floor((this.height - this.headerHeight - this.footerHeight) / this.rowHeight);
        this.maxScroll = Math.max(0, totalHeight - visibleRows * this.rowHeight);

        // Calculate which rows to show
        const startRow = Math.floor(this.scrollOffset / this.rowHeight);
        const endRow = Math.min(inhabitants.length, startRow + Math.ceil(this.height / this.rowHeight) + 1);

        // Draw individual rows
        for (let i = startRow; i < endRow; i++) {
            if (i >= 0 && i < inhabitants.length) {
                const rowY = this.y + this.headerHeight + (i * this.rowHeight) - this.scrollOffset;
                
                // Draw row separator
                stroke(150, 190, 210);
                strokeWeight(1);
                line(this.x, rowY + this.rowHeight, this.x + this.width, rowY + this.rowHeight);
                
                this.renderFishInfo(inhabitants[i], rowY);
            }
        }
    }

    private renderChemView(): void {
        const rowY = this.y + this.headerHeight;
        fill(0, 0, 0);
        textSize(12);
        textAlign(LEFT, CENTER);
        text('Coming soon', this.x + this.padding, rowY + this.rowHeight/2);
    }

    private renderActionsView(): void {
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
        text('Feed', this.x + this.padding + buttonWidth/2, buttonY + buttonHeight/2);
        
        // Handle feed button click
        if (this.mouseWasPressed && !mouseIsPressed) {
            if (mouseX >= this.x + this.padding && mouseX <= this.x + this.padding + buttonWidth &&
                mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
                this.handleFeedAction();
            }
        }
    }

    private handleFeedAction(): void {
        // Drop 10-20 food particles when feeding
        const numPellets = Math.floor(Math.random() * 10) + 40; // 40-50 pellets
        
        // Pick a feeding spot at least 100 pixels from any tank edge
        const feedingX = random(this.tank.x + 100, this.tank.x + this.tank.width - 100);
        const feedingZ = random(120, this.tank.depth - 100); // 120 = 20 (min z) + 100 (buffer)
        
        for (let i = 0; i < numPellets; i++) {
            // Stagger the drops slightly for a more natural look
            setTimeout(() => {
                this.tank.dropFood(feedingX, feedingZ);
            }, i * 25); // 100ms delay between each pellet
        }
        console.log(`Dropped ${numPellets} food pellets at feeding spot (${Math.round(feedingX)}, ${Math.round(feedingZ)})!`);
    }

    private drawMaskingFrame(tank: Tank): void {
        push();
        
        fill(255, 255, 255);
        noStroke();
        
        // Create three rectangles to mask overflow on top, bottom, and right sides
        const headerBottom = this.y + this.headerHeight;
        const hasFooter = this.selectedView === 'fish' && this.fishViewMode === 'individuals';
        const footerOffset = hasFooter ? this.footerHeight : 0;
        
        rect(this.x - 10, this.y - 20, this.width + 20, headerBottom - this.y + 20);
        rect(this.x - 10, this.y + this.height - footerOffset, this.width + 20, tank.height + 100);
        rect(this.x + this.width, 0, 500, tank.height + 100);
        
        // Redraw the pane border which was covered by our masks
        stroke(150, 190, 210);
        strokeWeight(1);
        noFill();
        rect(this.x, this.y, this.width, this.height);
        
        pop();
    }

    private renderSpeciesInfo(species: { type: 'embertetra' | 'snail', count: number, label: string }, y: number): void {
        // Draw species sprite
        if (species.type === 'embertetra' && EmberTetra.spritesheet) {
            // Use a default sprite for the species view
            const spriteConfig = EmberTetra.SPRITE_CONFIGS[2]; // Front-facing sprite
            const scale = 0.5;
            const spriteWidth = spriteConfig.width * scale;
            const spriteHeight = spriteConfig.height * scale;
            
            const spriteX = this.x + this.padding;
            const spriteY = y + (this.rowHeight - spriteHeight) / 2;
            
            image(
                EmberTetra.spritesheet,
                spriteX,
                spriteY,
                spriteWidth,
                spriteHeight,
                spriteConfig.x,
                spriteConfig.y,
                spriteConfig.width,
                spriteConfig.height
            );
        } else if (species.type === 'snail' && Snail.spritesheet) {
            // Use a default snail sprite
            const spriteConfig = Snail.SPRITE_CONFIGS[2]; // Front-facing sprite
            const scale = 0.5;
            const spriteWidth = spriteConfig.width * scale;
            const spriteHeight = spriteConfig.height * scale;
            
            const spriteX = this.x + this.padding;
            const spriteY = y + (this.rowHeight - spriteHeight) / 2;
            
            image(
                Snail.spritesheet,
                spriteX,
                spriteY,
                spriteWidth,
                spriteHeight,
                spriteConfig.x,
                spriteConfig.y,
                spriteConfig.width,
                spriteConfig.height
            );
        }

        // Draw species information
        push();
        textSize(12);
        fill(0, 0, 0);
        noStroke();
        textAlign(LEFT, CENTER);
        
        const infoX = this.x + this.padding + 50;
        const infoY = y + this.rowHeight / 2;
        
        text(`${species.label}: ${species.count}`, infoX, infoY);
        pop();

        // Handle click to drill down
        if (this.mouseWasPressed && !mouseIsPressed) {
            if (mouseX >= this.x && mouseX <= this.x + this.width &&
                mouseY >= y && mouseY <= y + this.rowHeight) {
                this.selectedSpecies = species.type;
                this.fishViewMode = 'individuals';
                this.scrollOffset = 0; // Reset scroll when switching views
            }
        }
    }

    private renderFishInfo(fish: Inhabitant, y: number): void {
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
                image(
                    EmberTetra.spritesheet,
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
        } else if (fish instanceof Snail && Snail.spritesheet) {
            // Draw snail sprite - use a simple front-facing sprite
            const spriteConfig = Snail.SPRITE_CONFIGS[2]; // Front-facing sprite
            const scale = 0.5;
            const spriteWidth = spriteConfig.width * scale;
            const spriteHeight = spriteConfig.height * scale;
            
            const spriteX = this.x + this.padding;
            const spriteY = y + (this.rowHeight - spriteHeight) / 2;
            
            image(
                Snail.spritesheet,
                spriteX,
                spriteY,
                spriteWidth,
                spriteHeight,
                spriteConfig.x,
                spriteConfig.y,
                spriteConfig.width,
                spriteConfig.height
            );
        }

        // Draw fish information
        push();
        textSize(12);
        fill(0, 0, 0); // Black text
        noStroke();
        textAlign(LEFT, CENTER);
        
        const infoX = this.x + this.padding + 50; // Start after the sprite
        const infoY = y + this.rowHeight / 2;
        
        // Show different information based on creature type
        if (fish instanceof Fish) {
            // Fear information
            const fearValue = Math.round(fish.getFearValue() * 100);
            const scaredStatus = fish.getFearValue() > 0.5 ? ' - scared' : '';
            text(`Fear: ${fearValue}%${scaredStatus}`, infoX, infoY - 9);
            
            // Hunger information
            const hungerValue = Math.round(fish.getHungerValue() * 100);
            const feedingStatus = fish.isInFeedingMode() ? ' - feeding' : '';
            text(`Hunger: ${hungerValue}%${feedingStatus}`, infoX, infoY + 9);
        } else if (fish instanceof Snail) {
            // Size and wall information
            text(`Size: ${fish.size} | Wall: ${fish.getWall()}`, infoX, infoY - 9);
            
            // Hunger and life state information
            const hungerValue = Math.round(fish.getHungerValue() * 100);
            const lifeState = fish.getLifeState();
            const lifeStateText = lifeState === 'normal' ? '' : ` - ${lifeState}`;
            text(`Hunger: ${hungerValue}%${lifeStateText}`, infoX, infoY + 9);
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
        text('×', deleteButtonX + deleteButtonSize/2, deleteButtonY + deleteButtonSize/2);

        // Handle delete button click release
        if (this.mouseWasPressed && !mouseIsPressed) {
            if (mouseX >= deleteButtonX && mouseX <= deleteButtonX + deleteButtonSize &&
                mouseY >= deleteButtonY && mouseY <= deleteButtonY + deleteButtonSize) {
                if (fish instanceof Snail) {
                    this.tank.removeSnail(fish);
                } else {
                    const index = this.tank.fish.indexOf(fish);
                    if (index > -1) {
                        this.tank.fish.splice(index, 1);
                    }
                }
            }
        }
    }
} 