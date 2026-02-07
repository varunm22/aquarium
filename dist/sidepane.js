import { EmberTetra } from './inhabitants/embertetra.js';
import { UserFish } from './inhabitants/userfish.js';
import { Fish } from './inhabitants/fish.js';
import { Snail } from './inhabitants/snail.js';
import { getTankBounds } from './constants.js';
import { handleSave, handleLoad, isModalOpen } from './save-load.js';
const CENTER = 'center';
const LEFT = 'left';
const RIGHT = 'right';
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
        this.fishViewMode = 'species';
        this.selectedSpecies = null;
        this.tank = tank;
        this.x = tank.x + tank.width + 50;
        this.y = tank.y;
        this.width = tank.width / 3;
        this.height = tank.height;
        this.rowHeight = 50;
        this.padding = 10;
        this.scrollOffset = 0;
        this.maxScroll = 0;
        window.addEventListener('wheel', (event) => this.handleScroll(event), { passive: false });
    }
    handleScroll(event) {
        const hasFooter = this.selectedView === 'fish' && this.fishViewMode === 'individuals';
        const footerOffset = hasFooter ? this.footerHeight : 0;
        if (event.clientX >= this.x && event.clientX <= this.x + this.width &&
            event.clientY >= this.y + this.headerHeight && event.clientY <= this.y + this.height - footerOffset &&
            this.selectedView === 'fish') {
            this.scrollOffset = Math.max(0, Math.min(this.maxScroll, this.scrollOffset + event.deltaY));
            event.preventDefault();
        }
    }
    addNewFish() {
        if (this.selectedView === 'fish' && this.fishViewMode === 'individuals' && this.selectedSpecies === 'snail') {
            this.tank.addFish(new Snail(20));
        }
        else {
            const bounds = getTankBounds();
            const x = random(bounds.min.x, bounds.max.x);
            const z = random(bounds.min.z, bounds.max.z);
            this.tank.addFish(new EmberTetra(x, -30, z, random(20, 30)));
        }
    }
    renderFooter() {
        const footerY = this.y + this.height - this.footerHeight;
        if (this.selectedView === 'fish' && this.fishViewMode === 'individuals') {
            fill(220, 240, 255);
            stroke(150, 190, 210);
            strokeWeight(1);
            rect(this.x, footerY, this.width, this.footerHeight);
            this.renderBackButton(footerY);
            this.renderAddNewButton(footerY);
        }
    }
    renderBackButton(footerY) {
        const buttonSize = 20;
        const buttonX = this.x + this.padding;
        const buttonY = footerY + (this.footerHeight - buttonSize) / 2;
        fill(200, 200, 200);
        stroke(150, 150, 150);
        strokeWeight(1);
        rect(buttonX, buttonY, buttonSize, buttonSize);
        fill(100, 100, 100);
        noStroke();
        textSize(12);
        textAlign(CENTER, CENTER);
        text('←', buttonX + buttonSize / 2, buttonY + buttonSize / 2);
        fill(0, 0, 0);
        textAlign(LEFT, CENTER);
        text('Back', buttonX + buttonSize + 10, buttonY + buttonSize / 2);
        if (this.mouseWasPressed && !mouseIsPressed) {
            if (mouseX >= buttonX && mouseX <= buttonX + buttonSize &&
                mouseY >= buttonY && mouseY <= buttonY + buttonSize &&
                mouseX <= this.x + this.width / 2) {
                this.fishViewMode = 'species';
                this.selectedSpecies = null;
                this.scrollOffset = 0;
            }
        }
    }
    renderAddNewButton(footerY) {
        const buttonSize = 20;
        const buttonY = footerY + (this.footerHeight - buttonSize) / 2;
        const isIndividualsView = this.selectedView === 'fish' && this.fishViewMode === 'individuals';
        const buttonX = isIndividualsView
            ? this.x + this.width - buttonSize - this.padding - 10
            : this.x + this.padding;
        if (isIndividualsView) {
            fill(0, 0, 0);
            textAlign(RIGHT, CENTER);
            const buttonText = this.selectedSpecies === 'snail' ? 'Add Snail' : 'Add Fish';
            text(buttonText, buttonX - 15, buttonY + buttonSize / 2);
        }
        fill(100, 200, 100);
        stroke(50, 150, 50);
        strokeWeight(1);
        rect(buttonX, buttonY, buttonSize, buttonSize);
        fill(255, 255, 255);
        noStroke();
        textSize(12);
        textAlign(CENTER, CENTER);
        text('+', buttonX + buttonSize / 2, buttonY + buttonSize / 2);
        if (!isIndividualsView) {
            fill(0, 0, 0);
            textAlign(LEFT, CENTER);
            text('Add New', buttonX + buttonSize + 10, buttonY + buttonSize / 2);
        }
        if (this.mouseWasPressed && !mouseIsPressed) {
            if (mouseX >= buttonX && mouseX <= buttonX + buttonSize &&
                mouseY >= buttonY && mouseY <= buttonY + buttonSize &&
                mouseX >= this.x + this.width / 2) {
                this.addNewFish();
            }
        }
    }
    render(tank) {
        fill(220, 240, 255);
        stroke(150, 190, 210);
        strokeWeight(1);
        rect(this.x, this.y, this.width, this.height);
        if (this.selectedView === 'fish') {
            this.renderFishView(tank);
        }
        else if (this.selectedView === 'chem') {
            this.renderChemView();
        }
        else if (this.selectedView === 'actions') {
            this.renderActionsView();
        }
        this.drawMaskingFrame(tank);
        fill(220, 240, 255);
        stroke(150, 190, 210);
        strokeWeight(1);
        this.renderHeader();
        this.renderFooter();
        this.renderSaveLoadButtons();
        this.mouseWasPressed = mouseIsPressed;
    }
    renderHeader() {
        const tabWidth = this.width / this.tabs.length;
        this.tabs.forEach((tab, index) => {
            const tabX = this.x + (index * tabWidth);
            const isSelected = this.selectedView === tab.id;
            fill(isSelected ? 220 : 180, isSelected ? 240 : 200, isSelected ? 255 : 220);
            stroke(150, 190, 210);
            strokeWeight(1);
            if (isSelected) {
                rect(tabX, this.y, tabWidth, this.headerHeight);
                stroke(150, 190, 210);
                strokeWeight(1);
                line(tabX, this.y, tabX + tabWidth, this.y);
                line(tabX, this.y, tabX, this.y + this.headerHeight);
                line(tabX + tabWidth, this.y, tabX + tabWidth, this.y + this.headerHeight);
                // "Erase" bottom border to create tab effect
                stroke(220, 240, 255);
                strokeWeight(2);
                line(tabX + 1, this.y + this.headerHeight, tabX + tabWidth - 1, this.y + this.headerHeight);
            }
            else {
                rect(tabX, this.y, tabWidth, this.headerHeight);
            }
            fill(0, 0, 0);
            textSize(12);
            textAlign(CENTER, CENTER);
            text(tab.label, tabX + tabWidth / 2, this.y + this.headerHeight / 2);
        });
        if (this.mouseWasPressed && !mouseIsPressed) {
            const clickedTabIndex = Math.floor((mouseX - this.x) / tabWidth);
            if (clickedTabIndex >= 0 && clickedTabIndex < this.tabs.length &&
                mouseY >= this.y && mouseY <= this.y + this.headerHeight) {
                this.selectedView = this.tabs[clickedTabIndex].id;
            }
        }
    }
    renderFishView(tank) {
        if (this.fishViewMode === 'species') {
            this.renderSpeciesView(tank);
        }
        else {
            this.renderIndividualsView(tank);
        }
    }
    renderSpeciesView(tank) {
        const emberTetraCount = tank.fish.filter(fish => fish instanceof EmberTetra && !(fish instanceof UserFish)).length;
        const snailCount = tank.getSnails().length;
        const species = [
            { type: 'embertetra', count: emberTetraCount, label: 'Ember Tetras' },
            { type: 'snail', count: snailCount, label: 'Snails' }
        ];
        const totalHeight = species.length * this.rowHeight;
        const visibleRows = Math.floor((this.height - this.headerHeight) / this.rowHeight);
        this.maxScroll = Math.max(0, totalHeight - visibleRows * this.rowHeight);
        const startRow = Math.floor(this.scrollOffset / this.rowHeight);
        const endRow = Math.min(species.length, startRow + Math.ceil(this.height / this.rowHeight) + 1);
        for (let i = startRow; i < endRow; i++) {
            if (i >= 0 && i < species.length) {
                const rowY = this.y + this.headerHeight + (i * this.rowHeight) - this.scrollOffset;
                stroke(150, 190, 210);
                strokeWeight(1);
                line(this.x, rowY + this.rowHeight, this.x + this.width, rowY + this.rowHeight);
                this.renderSpeciesInfo(species[i], rowY);
            }
        }
    }
    renderIndividualsView(tank) {
        if (!this.selectedSpecies)
            return;
        let inhabitants = [];
        if (this.selectedSpecies === 'embertetra') {
            inhabitants = tank.fish
                .filter(fish => fish instanceof EmberTetra && !(fish instanceof UserFish))
                .sort((a, b) => a.id.localeCompare(b.id));
        }
        else if (this.selectedSpecies === 'snail') {
            inhabitants = tank.getSnails().sort((a, b) => a.id.localeCompare(b.id));
        }
        const totalHeight = inhabitants.length * this.rowHeight;
        const visibleRows = Math.floor((this.height - this.headerHeight - this.footerHeight) / this.rowHeight);
        this.maxScroll = Math.max(0, totalHeight - visibleRows * this.rowHeight);
        const startRow = Math.floor(this.scrollOffset / this.rowHeight);
        const endRow = Math.min(inhabitants.length, startRow + Math.ceil(this.height / this.rowHeight) + 1);
        for (let i = startRow; i < endRow; i++) {
            if (i >= 0 && i < inhabitants.length) {
                const rowY = this.y + this.headerHeight + (i * this.rowHeight) - this.scrollOffset;
                stroke(150, 190, 210);
                strokeWeight(1);
                line(this.x, rowY + this.rowHeight, this.x + this.width, rowY + this.rowHeight);
                this.renderFishInfo(inhabitants[i], rowY);
            }
        }
    }
    renderChemView() {
        fill(0, 0, 0);
        textSize(12);
        textAlign(LEFT, CENTER);
        text('Coming soon', this.x + this.padding, this.y + this.headerHeight + this.rowHeight / 2);
    }
    renderActionsView() {
        const buttonY = this.y + this.headerHeight + this.padding;
        const buttonWidth = this.width - (this.padding * 2);
        const buttonHeight = 40;
        fill(100, 150, 255);
        stroke(50, 100, 200);
        strokeWeight(1);
        rect(this.x + this.padding, buttonY, buttonWidth, buttonHeight);
        fill(255, 255, 255);
        noStroke();
        textSize(14);
        textAlign(CENTER, CENTER);
        text('Feed', this.x + this.padding + buttonWidth / 2, buttonY + buttonHeight / 2);
        if (this.mouseWasPressed && !mouseIsPressed) {
            if (mouseX >= this.x + this.padding && mouseX <= this.x + this.padding + buttonWidth &&
                mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
                this.handleFeedAction();
            }
        }
    }
    handleFeedAction() {
        const numPellets = Math.floor(Math.random() * 10) + 40;
        const feedingX = random(this.tank.x + 100, this.tank.x + this.tank.width - 100);
        const feedingZ = random(120, this.tank.depth - 100);
        for (let i = 0; i < numPellets; i++) {
            setTimeout(() => {
                this.tank.dropFood(feedingX, feedingZ);
            }, i * 25);
        }
    }
    drawMaskingFrame(tank) {
        push();
        fill(255, 255, 255);
        noStroke();
        const headerBottom = this.y + this.headerHeight;
        const hasFooter = this.selectedView === 'fish' && this.fishViewMode === 'individuals';
        const footerOffset = hasFooter ? this.footerHeight : 0;
        rect(this.x - 10, this.y - 20, this.width + 20, headerBottom - this.y + 20);
        rect(this.x - 10, this.y + this.height - footerOffset, this.width + 20, tank.height + 100);
        rect(this.x + this.width, 0, 500, tank.height + 100);
        stroke(150, 190, 210);
        strokeWeight(1);
        noFill();
        rect(this.x, this.y, this.width, this.height);
        pop();
    }
    renderSpeciesInfo(species, y) {
        if (species.type === 'embertetra' && EmberTetra.spritesheet) {
            const spriteConfig = EmberTetra.SPRITE_CONFIGS[2];
            const sc = 0.5;
            const spriteWidth = spriteConfig.width * sc;
            const spriteHeight = spriteConfig.height * sc;
            image(EmberTetra.spritesheet, this.x + this.padding, y + (this.rowHeight - spriteHeight) / 2, spriteWidth, spriteHeight, spriteConfig.x, spriteConfig.y, spriteConfig.width, spriteConfig.height);
        }
        else if (species.type === 'snail' && Snail.spritesheet) {
            const spriteConfig = Snail.SPRITE_CONFIGS[2];
            const sc = 0.5;
            const spriteWidth = spriteConfig.width * sc;
            const spriteHeight = spriteConfig.height * sc;
            image(Snail.spritesheet, this.x + this.padding, y + (this.rowHeight - spriteHeight) / 2, spriteWidth, spriteHeight, spriteConfig.x, spriteConfig.y, spriteConfig.width, spriteConfig.height);
        }
        push();
        textSize(12);
        fill(0, 0, 0);
        noStroke();
        textAlign(LEFT, CENTER);
        text(`${species.label}: ${species.count}`, this.x + this.padding + 50, y + this.rowHeight / 2);
        pop();
        if (this.mouseWasPressed && !mouseIsPressed) {
            if (mouseX >= this.x && mouseX <= this.x + this.width &&
                mouseY >= y && mouseY <= y + this.rowHeight) {
                this.selectedSpecies = species.type;
                this.fishViewMode = 'individuals';
                this.scrollOffset = 0;
            }
        }
    }
    renderFishInfo(fish, y) {
        if (fish instanceof EmberTetra && EmberTetra.spritesheet) {
            const { index, mirrored } = fish.getSpriteInfo();
            if (index >= 0 && index < EmberTetra.SPRITE_CONFIGS.length) {
                const spriteConfig = EmberTetra.SPRITE_CONFIGS[index];
                const sc = 0.5;
                const spriteWidth = spriteConfig.width * sc;
                const spriteHeight = spriteConfig.height * sc;
                const spriteX = this.x + this.padding;
                const spriteY = y + (this.rowHeight - spriteHeight) / 2;
                image(EmberTetra.spritesheet, mirrored ? spriteX + spriteWidth : spriteX, spriteY, mirrored ? -spriteWidth : spriteWidth, spriteHeight, spriteConfig.x, spriteConfig.y, spriteConfig.width, spriteConfig.height);
            }
        }
        else if (fish instanceof Snail && Snail.spritesheet) {
            const spriteConfig = Snail.SPRITE_CONFIGS[2];
            const sc = 0.5;
            const spriteWidth = spriteConfig.width * sc;
            const spriteHeight = spriteConfig.height * sc;
            image(Snail.spritesheet, this.x + this.padding, y + (this.rowHeight - spriteHeight) / 2, spriteWidth, spriteHeight, spriteConfig.x, spriteConfig.y, spriteConfig.width, spriteConfig.height);
        }
        push();
        textSize(12);
        fill(0, 0, 0);
        noStroke();
        textAlign(LEFT, CENTER);
        const infoX = this.x + this.padding + 50;
        const infoY = y + this.rowHeight / 2;
        if (fish instanceof Fish) {
            const fearValue = Math.round(fish.getFearValue() * 100);
            const scaredStatus = fish.getFearValue() > 0.5 ? ' - scared' : '';
            text(`Fear: ${fearValue}%${scaredStatus}`, infoX, infoY - 9);
            const hungerValue = Math.round(fish.getHungerValue() * 100);
            const feedingStatus = fish.isInFeedingMode() ? ' - feeding' : '';
            text(`Hunger: ${hungerValue}%${feedingStatus}`, infoX, infoY + 9);
        }
        else if (fish instanceof Snail) {
            text(`Size: ${fish.size}`, infoX, infoY - 9);
            const hungerValue = Math.round(fish.getHungerValue() * 100);
            const lifeState = fish.getLifeState();
            const lifeStateText = lifeState === 'normal' ? '' : ` - ${lifeState}`;
            text(`Hunger: ${hungerValue}%${lifeStateText}`, infoX, infoY + 9);
        }
        pop();
        const deleteButtonSize = 16;
        const deleteButtonX = this.x + this.width - deleteButtonSize - this.padding;
        const deleteButtonY = y + (this.rowHeight - deleteButtonSize) / 2;
        fill(255, 200, 200);
        stroke(200, 100, 100);
        strokeWeight(1);
        rect(deleteButtonX, deleteButtonY, deleteButtonSize, deleteButtonSize);
        fill(200, 50, 50);
        noStroke();
        textSize(10);
        textAlign(CENTER, CENTER);
        text('×', deleteButtonX + deleteButtonSize / 2, deleteButtonY + deleteButtonSize / 2);
        if (this.mouseWasPressed && !mouseIsPressed) {
            if (mouseX >= deleteButtonX && mouseX <= deleteButtonX + deleteButtonSize &&
                mouseY >= deleteButtonY && mouseY <= deleteButtonY + deleteButtonSize) {
                if (fish instanceof Snail) {
                    this.tank.removeSnail(fish);
                }
                else {
                    const index = this.tank.fish.indexOf(fish);
                    if (index > -1)
                        this.tank.fish.splice(index, 1);
                }
            }
        }
    }
    renderSaveLoadButtons() {
        const buttonGap = 10;
        const buttonHeight = 30;
        const buttonY = this.y + this.height + buttonGap;
        const halfWidth = (this.width - this.padding) / 2;
        // Save button
        const saveX = this.x;
        fill(100, 160, 220);
        stroke(60, 120, 180);
        strokeWeight(1);
        rect(saveX, buttonY, halfWidth, buttonHeight);
        fill(255, 255, 255);
        noStroke();
        textSize(13);
        textAlign(CENTER, CENTER);
        text('Save', saveX + halfWidth / 2, buttonY + buttonHeight / 2);
        // Load button
        const loadX = this.x + halfWidth + this.padding;
        fill(100, 160, 220);
        stroke(60, 120, 180);
        strokeWeight(1);
        rect(loadX, buttonY, halfWidth, buttonHeight);
        fill(255, 255, 255);
        noStroke();
        textSize(13);
        textAlign(CENTER, CENTER);
        text('Load', loadX + halfWidth / 2, buttonY + buttonHeight / 2);
        // Click handling
        if (this.mouseWasPressed && !mouseIsPressed && !isModalOpen()) {
            if (mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
                if (mouseX >= saveX && mouseX <= saveX + halfWidth) {
                    handleSave(this.tank);
                }
                else if (mouseX >= loadX && mouseX <= loadX + halfWidth) {
                    handleLoad(this.tank);
                }
            }
        }
    }
}
