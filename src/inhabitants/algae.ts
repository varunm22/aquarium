import { TANK_CONSTANTS } from '../constants.js';

declare function fill(r: number, g: number, b: number, a: number): void;
declare function noStroke(): void;
declare function rect(x: number, y: number, w: number, h: number): void;
declare function quad(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): void;
declare function lerp(start: number, stop: number, amt: number): number;
declare function random(): number;

interface AlgaeHotspot {
    wall: 'front' | 'back' | 'left' | 'right';
    centerX: number;
    centerY: number;
    centerZ: number;
    strength: number;
    count: number;
}

type AlgaeWall = 'front' | 'back' | 'left' | 'right';

const HOTSPOT_UPDATE_INTERVAL = 50;
const HOTSPOT_LIMIT = 10;
const HOTSPOT_REGION_SIZE = 40;
const HOTSPOT_OVERLAP = 20;
const CLEANUP_CHANCE = 0.001;

export class Algae {
    private squareSize: number = 4;
    private newGrowthChance: number = 0.01;
    private spreadChance: number = 0.001;
    private levelUpChance: number = 0.0001;
    
    private wallDimensions!: {
        front: { width: number; height: number; gridCols: number; gridRows: number };
        back: { width: number; height: number; gridCols: number; gridRows: number };
        left: { width: number; height: number; gridCols: number; gridRows: number };
        right: { width: number; height: number; gridCols: number; gridRows: number };
    };

    // 2D grids for each wall (0 = no algae, 1-4 = algae levels)
    private wallGrids!: {
        front: number[][];
        back: number[][];
        left: number[][];
        right: number[][];
    };

    // Active cells encoded as: wallIndex * 1000000 + x * 1000 + y
    private activeCells: Set<number> = new Set();
    private wallIndices: { [key: string]: number } = { 'front': 0, 'back': 1, 'left': 2, 'right': 3 };
    private wallNames: AlgaeWall[] = ['front', 'back', 'left', 'right'];
    
    // Batch processing: sample 0.1% of active cells per frame, scale probabilities by 100x to compensate
    private samplingRate: number = 0.001;
    private probabilityScale: number = 100;
    private activeCellsArray: number[] = [];
    
    private randomPool: number[] = [];
    private randomIndex: number = 0;
    private readonly RANDOM_POOL_SIZE = 1000;

    private algaeHotspots: AlgaeHotspot[] = [];
    private frameCounter: number = 0;
    private lastHotspotUpdateFrame: number = 0;

    constructor() {
        this.calculateWallDimensions();
        this.initializeWallGrids();
        this.refillRandomPool();
        this.cleanupActiveCells();
        this.updateAlgaeHotspots();
    }

    private cleanupActiveCells(): void {
        const invalidCells: number[] = [];
        for (const encodedCell of this.activeCells) {
            if (encodedCell === undefined || encodedCell === null || encodedCell < 0 || isNaN(encodedCell)) {
                invalidCells.push(encodedCell);
            }
        }
        for (const invalidCell of invalidCells) {
            this.activeCells.delete(invalidCell);
        }
        if (invalidCells.length > 0) {
            console.log(`Cleaned up ${invalidCells.length} invalid cells from active set`);
        }
    }

    private encodeCell(wall: AlgaeWall, x: number, y: number): number {
        if (isNaN(x) || isNaN(y) || !this.wallIndices.hasOwnProperty(wall)) {
            console.warn('Invalid coordinates in encodeCell:', wall, x, y);
            return -1;
        }
        return this.wallIndices[wall] * 1000000 + x * 1000 + y;
    }

    private decodeCell(encoded: number): { wall: AlgaeWall, x: number, y: number } | null {
        if (isNaN(encoded) || encoded < 0) return null;
        
        const wallIndex = Math.floor(encoded / 1000000);
        const remainder = encoded % 1000000;
        const x = Math.floor(remainder / 1000);
        const y = remainder % 1000;
        
        if (wallIndex < 0 || wallIndex >= this.wallNames.length) return null;
        return { wall: this.wallNames[wallIndex], x, y };
    }

    private refillRandomPool(): void {
        this.randomPool.length = 0;
        for (let i = 0; i < this.RANDOM_POOL_SIZE; i++) {
            this.randomPool.push(random());
        }
        this.randomIndex = 0;
    }

    private fastRandom(): number {
        if (this.randomIndex >= this.randomPool.length) {
            this.refillRandomPool();
        }
        return this.randomPool[this.randomIndex++];
    }

    private calculateWallDimensions(): void {
        // Algae grows from water level to gravel level
        const waterLevelTop = TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT;
        const gravelLevel = TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT - TANK_CONSTANTS.GRAVEL_HEIGHT;
        const totalHeight = gravelLevel - waterLevelTop;
        
        const frontWidth = TANK_CONSTANTS.WIDTH;
        const sideGridWidth = TANK_CONSTANTS.DEPTH - TANK_CONSTANTS.MIN_Z;
        
        this.wallDimensions = {
            front: {
                width: frontWidth, height: totalHeight,
                gridCols: Math.floor(frontWidth / this.squareSize),
                gridRows: Math.floor(totalHeight / this.squareSize)
            },
            back: {
                width: TANK_CONSTANTS.WIDTH * TANK_CONSTANTS.BACK_SCALE, height: totalHeight,
                // Grid based on full-size dimensions so it covers full area when scaled
                gridCols: Math.floor(TANK_CONSTANTS.WIDTH / this.squareSize),
                gridRows: Math.floor(totalHeight / this.squareSize)
            },
            left: {
                width: TANK_CONSTANTS.DEPTH, height: totalHeight,
                gridCols: Math.floor(sideGridWidth / this.squareSize),
                gridRows: Math.floor(totalHeight / this.squareSize)
            },
            right: {
                width: TANK_CONSTANTS.DEPTH, height: totalHeight,
                gridCols: Math.floor(sideGridWidth / this.squareSize),
                gridRows: Math.floor(totalHeight / this.squareSize)
            }
        };
    }

    private initializeWallGrids(): void {
        this.wallGrids = {
            front: Array(this.wallDimensions.front.gridCols).fill(null).map(() => Array(this.wallDimensions.front.gridRows).fill(0)),
            back: Array(this.wallDimensions.back.gridCols).fill(null).map(() => Array(this.wallDimensions.back.gridRows).fill(0)),
            left: Array(this.wallDimensions.left.gridCols).fill(null).map(() => Array(this.wallDimensions.left.gridRows).fill(0)),
            right: Array(this.wallDimensions.right.gridCols).fill(null).map(() => Array(this.wallDimensions.right.gridRows).fill(0))
        };
    }

    public update(): void {
        this.frameCounter++;
        
        if (random() < this.newGrowthChance) {
            this.growAlgae();
        }
        
        this.processExistingAlgae();
        
        if (this.fastRandom() < CLEANUP_CHANCE) {
            this.cleanupActiveCells();
        }
    }

    private growAlgae(): void {
        const walls: AlgaeWall[] = ['front', 'back', 'left', 'right'];
        const randomWall = walls[Math.floor(random() * walls.length)];
        const wallDim = this.wallDimensions[randomWall];
        
        if (!wallDim || wallDim.gridCols <= 0 || wallDim.gridRows <= 0) return;
        
        const gridX = Math.floor(random() * wallDim.gridCols);
        const gridY = Math.floor(random() * wallDim.gridRows);
        
        if (isNaN(gridX) || isNaN(gridY) || gridX < 0 || gridY < 0 || gridX >= wallDim.gridCols || gridY >= wallDim.gridRows) return;
        
        if (this.wallGrids[randomWall][gridX][gridY] === 0) {
            this.wallGrids[randomWall][gridX][gridY] = 1;
            const encoded = this.encodeCell(randomWall, gridX, gridY);
            if (encoded !== -1) {
                this.activeCells.add(encoded);
            }
        }
    }

    private processExistingAlgae(): void {
        if (this.activeCellsArray.length !== this.activeCells.size) {
            this.activeCellsArray = Array.from(this.activeCells);
        }
        if (this.activeCellsArray.length === 0) return;
        
        const sampleSize = Math.max(1, Math.floor(this.activeCellsArray.length * this.samplingRate));
        
        for (let i = 0; i < sampleSize; i++) {
            const randomIndex = Math.floor(this.fastRandom() * this.activeCellsArray.length);
            const encodedCell = this.activeCellsArray[randomIndex];
            
            if (encodedCell === undefined || encodedCell === null) continue;
            
            const decodedCell = this.decodeCell(encodedCell);
            if (!decodedCell) {
                this.activeCells.delete(encodedCell);
                continue;
            }
            
            const { wall, x, y } = decodedCell;
            const level = this.wallGrids[wall][x][y];
            
            if (level === 0) {
                this.activeCells.delete(encodedCell);
                continue;
            }
            
            // Probabilities scaled by 100x since we only sample 0.1% of cells
            if (level < 4 && this.fastRandom() < this.levelUpChance * this.probabilityScale) {
                this.wallGrids[wall][x][y] = level + 1;
            }
            
            if (this.fastRandom() < this.spreadChance * this.probabilityScale) {
                this.spreadToAdjacent(wall, x, y);
            }
        }
    }

    private spreadToAdjacent(wall: AlgaeWall, x: number, y: number): void {
        const adjacentPositions = this.getAdjacentPositions(wall, x, y);
        const sourceLevel = this.wallGrids[wall][x][y];
        
        for (const pos of adjacentPositions) {
            const existingLevel = this.wallGrids[pos.wall][pos.gridX][pos.gridY];
            
            if (existingLevel < sourceLevel) {
                const scaledChance = 1 / Math.pow(3, existingLevel);
                if (this.fastRandom() < scaledChance) {
                    this.wallGrids[pos.wall][pos.gridX][pos.gridY] = Math.min(existingLevel + 1, 4);
                    if (existingLevel === 0) {
                        const encoded = this.encodeCell(pos.wall, pos.gridX, pos.gridY);
                        if (encoded !== -1) {
                            this.activeCells.add(encoded);
                        }
                    }
                }
            }
        }
    }

    private getAdjacentPositions(wall: AlgaeWall, x: number, y: number): Array<{wall: AlgaeWall, gridX: number, gridY: number}> {
        const positions: Array<{wall: AlgaeWall, gridX: number, gridY: number}> = [];
        const wallDim = this.wallDimensions[wall];
        
        const offsets = [{dx: 0, dy: -1}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 1, dy: 0}];
        
        for (const {dx, dy} of offsets) {
            const newX = x + dx;
            const newY = y + dy;
            if (newX >= 0 && newX < wallDim.gridCols && newY >= 0 && newY < wallDim.gridRows) {
                positions.push({ wall, gridX: newX, gridY: newY });
            }
        }
        
        this.addCrossWallConnections(wall, x, y, positions);
        return positions;
    }

    private addCrossWallConnections(wall: AlgaeWall, x: number, y: number, positions: Array<{wall: AlgaeWall, gridX: number, gridY: number}>): void {
        const wallDim = this.wallDimensions[wall];
        
        switch (wall) {
            case 'front':
                if (x === 0) positions.push({ wall: 'left', gridX: 0, gridY: y });
                if (x === wallDim.gridCols - 1) positions.push({ wall: 'right', gridX: 0, gridY: y });
                break;
            case 'back':
                if (x === 0) positions.push({ wall: 'left', gridX: this.wallDimensions.left.gridCols - 1, gridY: y });
                if (x === wallDim.gridCols - 1) positions.push({ wall: 'right', gridX: this.wallDimensions.right.gridCols - 1, gridY: y });
                break;
            case 'left':
                if (x === 0) positions.push({ wall: 'front', gridX: 0, gridY: y });
                if (x === wallDim.gridCols - 1) positions.push({ wall: 'back', gridX: 0, gridY: y });
                break;
            case 'right':
                if (x === 0) positions.push({ wall: 'front', gridX: this.wallDimensions.front.gridCols - 1, gridY: y });
                if (x === wallDim.gridCols - 1) positions.push({ wall: 'back', gridX: this.wallDimensions.back.gridCols - 1, gridY: y });
                break;
        }
    }

    public render(tank: any): void {
        for (const encodedCell of this.activeCells) {
            const decodedCell = this.decodeCell(encodedCell);
            if (!decodedCell) continue;
            
            const { wall, x, y } = decodedCell;
            if (wall === 'front') continue;
            
            const level = this.wallGrids[wall][x][y];
            if (level > 0) {
                this.renderSquare(tank, wall, x, y, level);
            }
        }
    }

    public renderFrontWall(tank: any): void {
        for (const encodedCell of this.activeCells) {
            const decodedCell = this.decodeCell(encodedCell);
            if (!decodedCell) continue;
            
            const { wall, x, y } = decodedCell;
            if (wall === 'front') {
                const level = this.wallGrids.front[x][y];
                if (level > 0) {
                    this.renderSquare(tank, 'front', x, y, level);
                }
            }
        }
    }

    public getAlgaeLevel(wall: AlgaeWall, wallX: number, wallY: number): number {
        const gridCoords = this.wallToGridCoordinates(wall, wallX, wallY);
        if (!gridCoords) return 0;
        
        const wallDim = this.wallDimensions[wall];
        if (gridCoords.gridX < 0 || gridCoords.gridX >= wallDim.gridCols || 
            gridCoords.gridY < 0 || gridCoords.gridY >= wallDim.gridRows) {
            return 0;
        }
        return this.wallGrids[wall][gridCoords.gridX][gridCoords.gridY];
    }

    public removeAlgae(wall: AlgaeWall, wallX: number, wallY: number): void {
        const gridCoords = this.wallToGridCoordinates(wall, wallX, wallY);
        if (!gridCoords) return;
        
        const { gridX, gridY } = gridCoords;
        const wallDim = this.wallDimensions[wall];
        if (gridX < 0 || gridX >= wallDim.gridCols || gridY < 0 || gridY >= wallDim.gridRows) return;
        
        if (this.wallGrids[wall][gridX][gridY] > 0) {
            this.wallGrids[wall][gridX][gridY] = 0;
            const encoded = this.encodeCell(wall, gridX, gridY);
            if (encoded !== -1) {
                this.activeCells.delete(encoded);
            }
        }
    }

    // Wall coordinate conventions:
    //   front/back: wallX = world X, wallY = world Y
    //   left/right: wallX = world Z, wallY = world Y
    private wallToGridCoordinates(wall: AlgaeWall, wallX: number, wallY: number): { gridX: number, gridY: number } | null {
        const waterLevelTop = TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT;
        
        switch (wall) {
            case 'front':
            case 'back':
                return {
                    gridX: Math.floor((wallX - TANK_CONSTANTS.X) / this.squareSize),
                    gridY: Math.floor((wallY - waterLevelTop) / this.squareSize)
                };
            case 'left':
            case 'right':
                return {
                    gridX: Math.floor((wallX - TANK_CONSTANTS.MIN_Z) / this.squareSize),
                    gridY: Math.floor((wallY - waterLevelTop) / this.squareSize)
                };
        }
    }

    private worldToGridCoordinates(wall: AlgaeWall, worldX: number, worldY: number, worldZ: number): { gridX: number, gridY: number } | null {
        const waterLevelTop = TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT;
        
        switch (wall) {
            case 'front':
            case 'back':
                return {
                    gridX: Math.floor((worldX - TANK_CONSTANTS.X) / this.squareSize),
                    gridY: Math.floor((worldY - waterLevelTop) / this.squareSize)
                };
            case 'left':
            case 'right':
                return {
                    gridX: Math.floor((worldZ - TANK_CONSTANTS.MIN_Z) / this.squareSize),
                    gridY: Math.floor((worldY - waterLevelTop) / this.squareSize)
                };
        }
    }

    private updateAlgaeHotspots(): void {
        if (this.frameCounter - this.lastHotspotUpdateFrame < HOTSPOT_UPDATE_INTERVAL) return;
        
        this.lastHotspotUpdateFrame = this.frameCounter;
        const stepSize = HOTSPOT_REGION_SIZE - HOTSPOT_OVERLAP;
        const hotspots = this.generateOverlappingHotspots(HOTSPOT_REGION_SIZE, stepSize);
        
        this.algaeHotspots = hotspots
            .filter(h => h.strength > 0)
            .sort((a, b) => b.strength - a.strength)
            .slice(0, HOTSPOT_LIMIT);
    }

    public requestHotspotUpdate(): void {
        this.updateAlgaeHotspots();
    }

    public getAlgaeHotspots(): AlgaeHotspot[] {
        return this.algaeHotspots;
    }

    public worldToGridCoordinatesPublic(wall: AlgaeWall, worldX: number, worldY: number, worldZ: number): { gridX: number, gridY: number } | null {
        return this.worldToGridCoordinates(wall, worldX, worldY, worldZ);
    }

    public getWallDimensions(): typeof this.wallDimensions {
        return this.wallDimensions;
    }

    public getWallGrids(): typeof this.wallGrids {
        return this.wallGrids;
    }

    private generateOverlappingHotspots(regionSize: number, stepSize: number): AlgaeHotspot[] {
        const hotspots: AlgaeHotspot[] = [];
        const gridRegionSize = Math.ceil(regionSize / this.squareSize);
        const gridStepSize = Math.ceil(stepSize / this.squareSize);
        
        for (const wall of this.wallNames) {
            const wallDim = this.wallDimensions[wall];
            
            for (let gridX = 0; gridX < wallDim.gridCols; gridX += gridStepSize) {
                for (let gridY = 0; gridY < wallDim.gridRows; gridY += gridStepSize) {
                    const regionStrength = this.countAlgaeInGridRegion(wall, gridX, gridY, gridRegionSize);
                    
                    if (regionStrength > 0) {
                        const centerGridX = gridX + gridRegionSize / 2;
                        const centerGridY = gridY + gridRegionSize / 2;
                        const worldCenter = this.gridToWorldCoordinates(wall, centerGridX, centerGridY);
                        
                        if (worldCenter) {
                            // Map to snail's WallPoint coordinate system
                            const goalX = (wall === 'left' || wall === 'right') ? worldCenter.z : worldCenter.x;
                            const goalY = worldCenter.y;
                            
                            hotspots.push({
                                wall, centerX: goalX, centerY: goalY, centerZ: worldCenter.z,
                                strength: regionStrength, count: 0
                            });
                        }
                    }
                }
            }
        }
        
        return hotspots;
    }

    private renderSquare(tank: any, wall: AlgaeWall, gridX: number, gridY: number, level: number): void {
        const alpha = level * 0.1;
        fill(0, 128, 0, alpha * 255);
        noStroke();
        
        const x = gridX * this.squareSize;
        const y = gridY * this.squareSize;
        
        switch (wall) {
            case 'front':
                rect(tank.x + x, tank.waterLevelTop + y, this.squareSize, this.squareSize);
                break;
                
            case 'back': {
                const backSize = this.squareSize * TANK_CONSTANTS.BACK_SCALE;
                const backX = tank.backX + x * TANK_CONSTANTS.BACK_SCALE;
                const backY = tank.waterLevelTopBack + y * TANK_CONSTANTS.BACK_SCALE;
                rect(backX, backY, backSize, backSize);
                break;
            }
                
            case 'left': {
                // Render as trapezoid for perspective: x = depth (z), y = height
                const depthRatio = x / this.wallDimensions.left.width;
                const nextDepthRatio = (x + this.squareSize) / this.wallDimensions.left.width;
                
                const frontX = tank.x;
                const frontY = tank.waterLevelTop + y;
                const bX = tank.backX;
                const bY = tank.waterLevelTopBack + y * TANK_CONSTANTS.BACK_SCALE;
                
                const x1 = lerp(frontX, bX, depthRatio);
                const y1 = lerp(frontY, bY, depthRatio);
                const x2 = lerp(frontX, bX, nextDepthRatio);
                const y2 = lerp(frontY, bY, nextDepthRatio);
                
                const bottomY1 = lerp(frontY + this.squareSize, bY + this.squareSize * TANK_CONSTANTS.BACK_SCALE, depthRatio);
                const bottomY2 = lerp(frontY + this.squareSize, bY + this.squareSize * TANK_CONSTANTS.BACK_SCALE, nextDepthRatio);
                
                quad(x1, y1, x2, y2, x2, bottomY2, x1, bottomY1);
                break;
            }
                
            case 'right': {
                const depthRatio = x / this.wallDimensions.right.width;
                const nextDepthRatio = (x + this.squareSize) / this.wallDimensions.right.width;
                
                const frontX = tank.x + tank.width;
                const frontY = tank.waterLevelTop + y;
                const bX = tank.backX + tank.backWidth;
                const bY = tank.waterLevelTopBack + y * TANK_CONSTANTS.BACK_SCALE;
                
                const x1 = lerp(frontX, bX, depthRatio);
                const y1 = lerp(frontY, bY, depthRatio);
                const x2 = lerp(frontX, bX, nextDepthRatio);
                const y2 = lerp(frontY, bY, nextDepthRatio);
                
                const bottomY1 = lerp(frontY + this.squareSize, bY + this.squareSize * TANK_CONSTANTS.BACK_SCALE, depthRatio);
                const bottomY2 = lerp(frontY + this.squareSize, bY + this.squareSize * TANK_CONSTANTS.BACK_SCALE, nextDepthRatio);
                
                quad(x1, y1, x2, y2, x2, bottomY2, x1, bottomY1);
                break;
            }
        }
    }

    private countAlgaeInGridRegion(wall: AlgaeWall, startGridX: number, startGridY: number, gridRegionSize: number): number {
        let totalStrength = 0;
        const wallDim = this.wallDimensions[wall];
        
        const maxX = Math.min(startGridX + gridRegionSize, wallDim.gridCols);
        const maxY = Math.min(startGridY + gridRegionSize, wallDim.gridRows);
        
        for (let gridX = startGridX; gridX < maxX; gridX++) {
            for (let gridY = startGridY; gridY < maxY; gridY++) {
                if (gridX >= 0 && gridY >= 0) {
                    totalStrength += this.wallGrids[wall][gridX][gridY];
                }
            }
        }
        
        return totalStrength;
    }

    private gridToWorldCoordinates(wall: AlgaeWall, gridX: number, gridY: number): { x: number, y: number, z: number } | null {
        const waterLevelTop = TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT;
        const worldX = gridX * this.squareSize;
        const worldY = gridY * this.squareSize + waterLevelTop;
        
        switch (wall) {
            case 'front':
                return { x: worldX + TANK_CONSTANTS.X, y: worldY, z: TANK_CONSTANTS.MIN_Z + 5 };
            case 'back':
                return { x: worldX + TANK_CONSTANTS.X, y: worldY, z: TANK_CONSTANTS.DEPTH - 5 };
            case 'left':
                return { x: TANK_CONSTANTS.X + 5, y: worldY, z: worldX + TANK_CONSTANTS.MIN_Z };
            case 'right':
                return { x: TANK_CONSTANTS.X + TANK_CONSTANTS.WIDTH - 5, y: worldY, z: worldX + TANK_CONSTANTS.MIN_Z };
        }
    }
}
