import { TANK_CONSTANTS } from '../constants.js';

// Declare p5.js global functions for rendering
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



export class Algae {
    private squareSize: number = 4;
    private newGrowthChance: number = 0.01; // 1% chance per frame for new algae
    private spreadChance: number = 0.003; // 1% chance per frame for spreading
    private levelUpChance: number = 0.0001; // 1% chance per frame for level 1 to become level 2
    
    // Wall dimensions (calculated once)
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

    // Active set tracking - only cells with algae (using numeric encoding for speed)
    private activeCells: Set<number> = new Set(); // Encoded as: wallIndex * 1000000 + x * 1000 + y
    private wallIndices: { [key: string]: number } = { 'front': 0, 'back': 1, 'left': 2, 'right': 3 };
    private wallNames: ('front' | 'back' | 'left' | 'right')[] = ['front', 'back', 'left', 'right'];
    
    // Batch processing - sample 0.1% of active cells per frame
    private samplingRate: number = 0.001; // Process 0.1% of active cells per frame
    private probabilityScale: number = 100; // Scale probabilities by 100x to compensate
    private activeCellsArray: number[] = []; // Pre-allocated array to avoid Array.from() every frame
    
    // Pre-generated random numbers for performance
    private randomPool: number[] = [];
    private randomIndex: number = 0;
    private readonly RANDOM_POOL_SIZE = 1000;

    // Algae hotspot tracking for snail navigation
    private algaeHotspots: AlgaeHotspot[] = [];
    private frameCounter: number = 0; // Add frame counter for more controlled updates

    // Removed chunked rendering variables to eliminate flickering

    constructor() {
        this.calculateWallDimensions();
        this.initializeWallGrids();
        this.refillRandomPool();
        this.cleanupActiveCells();
        this.updateAlgaeHotspots(); // Initial hotspot calculation
    }

    // Clean up any invalid cells that might be in the active set
    private cleanupActiveCells(): void {
        const invalidCells: number[] = [];
        
        for (const encodedCell of this.activeCells) {
            if (encodedCell === undefined || encodedCell === null || encodedCell < 0 || isNaN(encodedCell)) {
                invalidCells.push(encodedCell);
            }
        }
        
        // Remove invalid cells
        for (const invalidCell of invalidCells) {
            this.activeCells.delete(invalidCell);
        }
        
        if (invalidCells.length > 0) {
            console.log(`Cleaned up ${invalidCells.length} invalid cells from active set`);
        }
    }

    // Helper functions for encoding/decoding cell coordinates
    private encodeCell(wall: 'front' | 'back' | 'left' | 'right', x: number, y: number): number {
        // Validate inputs to prevent NaN
        if (isNaN(x) || isNaN(y) || !this.wallIndices.hasOwnProperty(wall)) {
            console.warn('Invalid coordinates in encodeCell:', wall, x, y);
            return -1; // Invalid encoding
        }
        return this.wallIndices[wall] * 1000000 + x * 1000 + y;
    }

    private decodeCell(encoded: number): { wall: 'front' | 'back' | 'left' | 'right', x: number, y: number } | null {
        // Validate input
        if (isNaN(encoded) || encoded < 0) {
            console.warn('Invalid encoded cell:', encoded);
            return null;
        }
        
        const wallIndex = Math.floor(encoded / 1000000);
        const remainder = encoded % 1000000;
        const x = Math.floor(remainder / 1000);
        const y = remainder % 1000;
        
        // Validate wall index
        if (wallIndex < 0 || wallIndex >= this.wallNames.length) {
            console.warn('Invalid wall index:', wallIndex);
            return null;
        }
        
        return { wall: this.wallNames[wallIndex], x, y };
    }

    // Fast random number generation using pre-filled pool
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
        // Include gravel area - algae can grow from water level to tank bottom
        const totalHeight = TANK_CONSTANTS.HEIGHT * (1 - TANK_CONSTANTS.WATER_LEVEL_PERCENT);
        
        // Front and back walls
        const frontWidth = TANK_CONSTANTS.WIDTH;
        const backWidth = TANK_CONSTANTS.WIDTH * TANK_CONSTANTS.BACK_SCALE;
        
        // Side walls (depth represents the "width" of the side walls)
        const sideWidth = TANK_CONSTANTS.DEPTH;
        
        this.wallDimensions = {
            front: {
                width: frontWidth,
                height: totalHeight,
                gridCols: Math.floor(frontWidth / this.squareSize),
                gridRows: Math.floor(totalHeight / this.squareSize)
            },
            back: {
                width: backWidth,
                height: totalHeight,
                // Calculate back wall grid based on full-size dimensions so it covers the full area when scaled
                gridCols: Math.floor(TANK_CONSTANTS.WIDTH / this.squareSize),
                gridRows: Math.floor(totalHeight / this.squareSize)
            },
            left: {
                width: sideWidth,
                height: totalHeight,
                gridCols: Math.floor(sideWidth / this.squareSize),
                gridRows: Math.floor(totalHeight / this.squareSize)
            },
            right: {
                width: sideWidth,
                height: totalHeight,
                gridCols: Math.floor(sideWidth / this.squareSize),
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
        
        // 1% chance to create new algae each frame
        if (random() < this.newGrowthChance) {
            this.growAlgae();
        }
        
        // Process existing algae for spreading and level progression
        this.processExistingAlgae();
        
        // Periodic cleanup of invalid cells (every ~1000 frames)
        if (this.fastRandom() < 0.001) {
            this.cleanupActiveCells();
        }

        // Update algae hotspots less frequently (every ~1000 frames instead of 1% chance)
        if (this.frameCounter % 1000 === 0) {
            this.updateAlgaeHotspots();
        }
    }

    private growAlgae(): void {
        // Choose a random wall
        const walls: ('front' | 'back' | 'left' | 'right')[] = ['front', 'back', 'left', 'right'];
        const randomWall = walls[Math.floor(random() * walls.length)];
        
        // Choose a random grid position on that wall
        const wallDim = this.wallDimensions[randomWall];
        
        // Validate wall dimensions
        if (!wallDim || wallDim.gridCols <= 0 || wallDim.gridRows <= 0) {
            console.warn('Invalid wall dimensions for:', randomWall, wallDim);
            return;
        }
        
        const gridX = Math.floor(random() * wallDim.gridCols);
        const gridY = Math.floor(random() * wallDim.gridRows);
        
        // Validate coordinates
        if (isNaN(gridX) || isNaN(gridY) || gridX < 0 || gridY < 0 || gridX >= wallDim.gridCols || gridY >= wallDim.gridRows) {
            console.warn('Invalid coordinates generated:', gridX, gridY, 'for wall:', randomWall);
            return;
        }
        
        // Check if this square already has algae
        if (this.wallGrids[randomWall][gridX][gridY] === 0) {
            // Create new level 1 algae square
            this.wallGrids[randomWall][gridX][gridY] = 1;
            // Add to active set
            const encoded = this.encodeCell(randomWall, gridX, gridY);
            if (encoded !== -1) {
                this.activeCells.add(encoded);
            }
        }
    }

    private processExistingAlgae(): void {
        // Update pre-allocated array only when needed
        if (this.activeCellsArray.length !== this.activeCells.size) {
            this.activeCellsArray = Array.from(this.activeCells);
        }
        
        // Exit early if no active cells
        if (this.activeCellsArray.length === 0) {
            return;
        }
        
        // Sample 1% of active cells (but process at least 1 cell if any exist)
        const sampleSize = Math.max(1, Math.floor(this.activeCellsArray.length * this.samplingRate));
        
        // Simple random sampling - much faster than Fisher-Yates for small sample sizes
        for (let i = 0; i < sampleSize; i++) {
            const randomIndex = Math.floor(this.fastRandom() * this.activeCellsArray.length);
            const encodedCell = this.activeCellsArray[randomIndex];
            
            // Skip if encodedCell is undefined or invalid
            if (encodedCell === undefined || encodedCell === null) {
                continue;
            }
            
            // Decode cell coordinates
            const decodedCell = this.decodeCell(encodedCell);
            if (!decodedCell) {
                this.activeCells.delete(encodedCell);
                continue;
            }
            
            const { wall, x, y } = decodedCell;
            const level = this.wallGrids[wall][x][y];
            
            // Skip if cell was somehow removed
            if (level === 0) {
                this.activeCells.delete(encodedCell);
                continue;
            }
            
            // Scaled chance for squares to level up (100x more likely since we sample 1%)
            if (level < 4 && this.fastRandom() < this.levelUpChance * this.probabilityScale) {
                this.wallGrids[wall][x][y] = level + 1;
            }
            
            // Scaled chance for each square to spread to adjacent squares
            if (this.fastRandom() < this.spreadChance * this.probabilityScale) {
                this.spreadToAdjacent(wall, x, y);
            }
        }
    }

    private spreadToAdjacent(wall: 'front' | 'back' | 'left' | 'right', x: number, y: number): void {
        // Get adjacent positions on the same wall
        const adjacentPositions = this.getAdjacentPositions(wall, x, y);
        const sourceLevel = this.wallGrids[wall][x][y];
        
        for (const pos of adjacentPositions) {
            // Check if this position already has algae
            const existingLevel = this.wallGrids[pos.wall][pos.gridX][pos.gridY];
            
            // Existing algae is lower level, calculate scaled chance based on target level
            if (existingLevel < sourceLevel) {
                const scaledChance = 1 / Math.pow(3, existingLevel);
                if (this.fastRandom() < scaledChance) {
                    // Level it up by 1 (up to level 4)
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

    private getAdjacentPositions(wall: 'front' | 'back' | 'left' | 'right', x: number, y: number): Array<{wall: 'front' | 'back' | 'left' | 'right', gridX: number, gridY: number}> {
        const positions: Array<{wall: 'front' | 'back' | 'left' | 'right', gridX: number, gridY: number}> = [];
        const wallDim = this.wallDimensions[wall];
        
        // Check all 4 adjacent positions (up, down, left, right)
        const adjacentOffsets = [
            {dx: 0, dy: -1}, // up
            {dx: 0, dy: 1},  // down
            {dx: -1, dy: 0}, // left
            {dx: 1, dy: 0}   // right
        ];
        
        for (const offset of adjacentOffsets) {
            const newX = x + offset.dx;
            const newY = y + offset.dy;
            
            // Check if the new position is within bounds of the same wall
            if (newX >= 0 && newX < wallDim.gridCols && newY >= 0 && newY < wallDim.gridRows) {
                positions.push({
                    wall: wall,
                    gridX: newX,
                    gridY: newY
                });
            }
        }
        
        // Add cross-wall connections
        this.addCrossWallConnections(wall, x, y, positions);
        
        return positions;
    }

    private addCrossWallConnections(wall: 'front' | 'back' | 'left' | 'right', x: number, y: number, positions: Array<{wall: 'front' | 'back' | 'left' | 'right', gridX: number, gridY: number}>): void {
        const wallDim = this.wallDimensions[wall];
        
        switch (wall) {
            case 'front':
                // Front wall connects to left and right walls
                if (x === 0) {
                    // Left edge of front wall connects to front edge of left wall
                    positions.push({
                        wall: 'left',
                        gridX: 0,
                        gridY: y
                    });
                }
                if (x === wallDim.gridCols - 1) {
                    // Right edge of front wall connects to front edge of right wall
                    positions.push({
                        wall: 'right',
                        gridX: 0,
                        gridY: y
                    });
                }
                break;
                
            case 'back':
                // Back wall connects to left and right walls
                if (x === 0) {
                    // Left edge of back wall connects to back edge of left wall
                    const leftWallDim = this.wallDimensions.left;
                    positions.push({
                        wall: 'left',
                        gridX: leftWallDim.gridCols - 1,
                        gridY: y
                    });
                }
                if (x === wallDim.gridCols - 1) {
                    // Right edge of back wall connects to back edge of right wall
                    const rightWallDim = this.wallDimensions.right;
                    positions.push({
                        wall: 'right',
                        gridX: rightWallDim.gridCols - 1,
                        gridY: y
                    });
                }
                break;
                
            case 'left':
                // Left wall connects to front and back walls
                if (x === 0) {
                    // Front edge of left wall connects to left edge of front wall
                    positions.push({
                        wall: 'front',
                        gridX: 0,
                        gridY: y
                    });
                }
                if (x === wallDim.gridCols - 1) {
                    // Back edge of left wall connects to left edge of back wall
                    positions.push({
                        wall: 'back',
                        gridX: 0,
                        gridY: y
                    });
                }
                break;
                
            case 'right':
                // Right wall connects to front and back walls
                if (x === 0) {
                    // Front edge of right wall connects to right edge of front wall
                    const frontWallDim = this.wallDimensions.front;
                    positions.push({
                        wall: 'front',
                        gridX: frontWallDim.gridCols - 1,
                        gridY: y
                    });
                }
                if (x === wallDim.gridCols - 1) {
                    // Back edge of right wall connects to right edge of back wall
                    const backWallDim = this.wallDimensions.back;
                    positions.push({
                        wall: 'back',
                        gridX: backWallDim.gridCols - 1,
                        gridY: y
                    });
                }
                break;
        }
    }

    public render(tank: any): void {
        // Render all algae squares (excluding front wall which is rendered separately)
        for (const encodedCell of this.activeCells) {
            const decodedCell = this.decodeCell(encodedCell);
            if (!decodedCell) continue;
            
            const { wall, x, y } = decodedCell;
            
            // Skip front wall (rendered separately)
            if (wall === 'front') continue;
            
            const level = this.wallGrids[wall][x][y];
            if (level > 0) {
                this.renderSquare(tank, wall, x, y, level);
            }
        }
    }

    public renderFrontWall(tank: any): void {
        // Render all front wall algae squares
        for (const encodedCell of this.activeCells) {
            const decodedCell = this.decodeCell(encodedCell);
            if (!decodedCell) continue;
            
            const { wall, x, y } = decodedCell;
            
            // Only render front wall cells
            if (wall === 'front') {
                const level = this.wallGrids.front[x][y];
                if (level > 0) {
                    this.renderSquare(tank, 'front', x, y, level);
                }
            }
        }
    }

    // Public methods for snail interaction
    public getAlgaeLevel(wall: 'front' | 'back' | 'left' | 'right', worldX: number, worldY: number, worldZ: number): number {
        // Convert world coordinates to grid coordinates
        const gridCoords = this.worldToGridCoordinates(wall, worldX, worldY, worldZ);
        if (!gridCoords) return 0;
        
        const { gridX, gridY } = gridCoords;
        
        // Check bounds
        const wallDim = this.wallDimensions[wall];
        if (gridX < 0 || gridX >= wallDim.gridCols || gridY < 0 || gridY >= wallDim.gridRows) {
            return 0;
        }
        
        return this.wallGrids[wall][gridX][gridY];
    }

    public removeAlgae(wall: 'front' | 'back' | 'left' | 'right', worldX: number, worldY: number, worldZ: number): void {
        // Convert world coordinates to grid coordinates
        const gridCoords = this.worldToGridCoordinates(wall, worldX, worldY, worldZ);
        if (!gridCoords) return;
        
        const { gridX, gridY } = gridCoords;
        
        // Check bounds
        const wallDim = this.wallDimensions[wall];
        if (gridX < 0 || gridX >= wallDim.gridCols || gridY < 0 || gridY >= wallDim.gridRows) {
            return;
        }
        
        // Remove algae if it exists
        if (this.wallGrids[wall][gridX][gridY] > 0) {
            this.wallGrids[wall][gridX][gridY] = 0;
            
            // Remove from active cells
            const encoded = this.encodeCell(wall, gridX, gridY);
            if (encoded !== -1) {
                this.activeCells.delete(encoded);
            }
        }
    }

    private worldToGridCoordinates(wall: 'front' | 'back' | 'left' | 'right', worldX: number, worldY: number, worldZ: number): { gridX: number, gridY: number } | null {
        
        // Calculate grid coordinates based on wall
        const waterLevelTop = TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT;
        
        switch (wall) {
            case 'front':
                return {
                    gridX: Math.floor((worldX - TANK_CONSTANTS.X) / this.squareSize),
                    gridY: Math.floor((worldY - waterLevelTop) / this.squareSize)
                };
            case 'back':
                return {
                    gridX: Math.floor((worldX - TANK_CONSTANTS.X) / this.squareSize),
                    gridY: Math.floor((worldY - waterLevelTop) / this.squareSize)
                };
            case 'left':
                return {
                    gridX: Math.floor((worldZ - TANK_CONSTANTS.MIN_Z) / this.squareSize),
                    gridY: Math.floor((worldY - waterLevelTop) / this.squareSize)
                };
            case 'right':
                return {
                    gridX: Math.floor((worldZ - TANK_CONSTANTS.MIN_Z) / this.squareSize),
                    gridY: Math.floor((worldY - waterLevelTop) / this.squareSize)
                };
            default:
                return null;
        }
    }

    private updateAlgaeHotspots(): void {
        this.algaeHotspots = [];
        const gridSize = 20; // Group algae into 20x20 pixel regions
        const hotspotMap = new Map<string, AlgaeHotspot>();

        // Process each active algae cell
        for (const encodedCell of this.activeCells) {
            const decodedCell = this.decodeCell(encodedCell);
            if (!decodedCell) continue;

            const { wall, x, y } = decodedCell;
            const level = this.wallGrids[wall][x][y];
            if (level === 0) continue;

            // Convert grid coordinates to world coordinates
            const worldCoords = this.gridToWorldCoordinates(wall, x, y);
            if (!worldCoords) continue;

            // Calculate hotspot region
            const regionX = Math.floor(worldCoords.worldX / gridSize) * gridSize;
            const regionY = Math.floor(worldCoords.worldY / gridSize) * gridSize;
            const regionZ = Math.floor(worldCoords.worldZ / gridSize) * gridSize;
            const regionKey = `${wall}-${regionX}-${regionY}-${regionZ}`;

            // Add to or create hotspot
            if (hotspotMap.has(regionKey)) {
                const hotspot = hotspotMap.get(regionKey)!;
                hotspot.strength += level;
                hotspot.count++;
                // Update center to be weighted average
                hotspot.centerX = (hotspot.centerX * (hotspot.count - 1) + worldCoords.worldX) / hotspot.count;
                hotspot.centerY = (hotspot.centerY * (hotspot.count - 1) + worldCoords.worldY) / hotspot.count;
                hotspot.centerZ = (hotspot.centerZ * (hotspot.count - 1) + worldCoords.worldZ) / hotspot.count;
            } else {
                hotspotMap.set(regionKey, {
                    wall,
                    centerX: worldCoords.worldX,
                    centerY: worldCoords.worldY,
                    centerZ: worldCoords.worldZ,
                    strength: level,
                    count: 1
                });
            }
        }

        // Convert map to array and sort by strength
        this.algaeHotspots = Array.from(hotspotMap.values())
            .filter(hotspot => hotspot.strength > 0)
            .sort((a, b) => b.strength - a.strength);
    }

    private gridToWorldCoordinates(wall: 'front' | 'back' | 'left' | 'right', gridX: number, gridY: number): { worldX: number, worldY: number, worldZ: number } | null {
        const waterLevelTop = TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT;
        
        switch (wall) {
            case 'front':
                return {
                    worldX: TANK_CONSTANTS.X + (gridX * this.squareSize) + (this.squareSize / 2),
                    worldY: waterLevelTop + (gridY * this.squareSize) + (this.squareSize / 2),
                    worldZ: TANK_CONSTANTS.MIN_Z + 5 // Wall offset
                };
            case 'back':
                return {
                    worldX: TANK_CONSTANTS.X + (gridX * this.squareSize) + (this.squareSize / 2),
                    worldY: waterLevelTop + (gridY * this.squareSize) + (this.squareSize / 2),
                    worldZ: TANK_CONSTANTS.DEPTH - 5 // Wall offset
                };
            case 'left':
                return {
                    worldX: TANK_CONSTANTS.X + 5, // Wall offset
                    worldY: waterLevelTop + (gridY * this.squareSize) + (this.squareSize / 2),
                    worldZ: TANK_CONSTANTS.MIN_Z + (gridX * this.squareSize) + (this.squareSize / 2)
                };
            case 'right':
                return {
                    worldX: TANK_CONSTANTS.X + TANK_CONSTANTS.WIDTH - 5, // Wall offset
                    worldY: waterLevelTop + (gridY * this.squareSize) + (this.squareSize / 2),
                    worldZ: TANK_CONSTANTS.MIN_Z + (gridX * this.squareSize) + (this.squareSize / 2)
                };
            default:
                return null;
        }
    }

    public findBestAlgaeTarget(snailX: number, snailY: number, snailZ: number, maxDistance: number = 600): { x: number, y: number, z: number, wall: 'front' | 'back' | 'left' | 'right' } | null {
        let bestTarget: { x: number, y: number, z: number, wall: 'front' | 'back' | 'left' | 'right' } | null = null;
        let bestScore = -1;

        for (const hotspot of this.algaeHotspots) {
            const distance = Math.sqrt(
                Math.pow(hotspot.centerX - snailX, 2) +
                Math.pow(hotspot.centerY - snailY, 2) +
                Math.pow(hotspot.centerZ - snailZ, 2)
            );

            if (distance > maxDistance) continue;

            // Improved scoring: balance between algae amount and distance
            // Formula: (algae_strength * algae_count) / (distance^1.5 + 50)
            // This gives more weight to algae amount while still considering distance
            // The ^1.5 makes distance less punishing than linear, and +50 prevents division by very small numbers
            const algaeValue = hotspot.strength * hotspot.count;
            const distancePenalty = Math.pow(distance + 50, 1.5);
            const score = algaeValue / distancePenalty;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = {
                    x: hotspot.centerX,
                    y: hotspot.centerY,
                    z: hotspot.centerZ,
                    wall: hotspot.wall
                };
            }
        }

        return bestTarget;
    }

    public getHotspotCount(): number {
        return this.algaeHotspots.length;
    }

    private renderSquare(tank: any, wall: 'front' | 'back' | 'left' | 'right', gridX: number, gridY: number, level: number): void {
        const alpha = level * 0.1
        fill(0, 128, 0, alpha * 255); // Green with appropriate alpha
        noStroke();
        
        const x = gridX * this.squareSize;
        const y = gridY * this.squareSize;
        
        switch (wall) {
            case 'front':
                // Front wall is simple - just draw the rectangle
                rect(tank.x + x, tank.waterLevelTop + y, this.squareSize, this.squareSize);
                break;
                
            case 'back':
                // Back wall is scaled to 0.7 to match the perspective
                const backSize = this.squareSize * TANK_CONSTANTS.BACK_SCALE;
                const backX = tank.backX + x * TANK_CONSTANTS.BACK_SCALE;
                const backY = tank.waterLevelTopBack + y * TANK_CONSTANTS.BACK_SCALE;
                rect(backX, backY, backSize, backSize);
                break;
                
            case 'left':
                // Left wall - render as a trapezoid showing perspective
                // x represents depth (z-coordinate), y represents height
                const leftDepthRatio = x / this.wallDimensions.left.width;
                const leftNextDepthRatio = (x + this.squareSize) / this.wallDimensions.left.width;
                
                // Calculate the four corners of the trapezoid
                const leftFrontX = tank.x;
                const leftFrontY = tank.waterLevelTop + y;
                const leftBackX = tank.backX;
                const leftBackY = tank.waterLevelTopBack + y * TANK_CONSTANTS.BACK_SCALE;
                
                const leftX1 = lerp(leftFrontX, leftBackX, leftDepthRatio);
                const leftY1 = lerp(leftFrontY, leftBackY, leftDepthRatio);
                const leftX2 = lerp(leftFrontX, leftBackX, leftNextDepthRatio);
                const leftY2 = lerp(leftFrontY, leftBackY, leftNextDepthRatio);
                
                const leftBottomY1 = lerp(leftFrontY + this.squareSize, leftBackY + this.squareSize * TANK_CONSTANTS.BACK_SCALE, leftDepthRatio);
                const leftBottomY2 = lerp(leftFrontY + this.squareSize, leftBackY + this.squareSize * TANK_CONSTANTS.BACK_SCALE, leftNextDepthRatio);
                
                quad(leftX1, leftY1, leftX2, leftY2, leftX2, leftBottomY2, leftX1, leftBottomY1);
                break;
                
            case 'right':
                // Right wall - similar trapezoid but on the right side
                const rightDepthRatio = x / this.wallDimensions.right.width;
                const rightNextDepthRatio = (x + this.squareSize) / this.wallDimensions.right.width;
                
                const rightFrontX = tank.x + tank.width;
                const rightFrontY = tank.waterLevelTop + y;
                const rightBackX = tank.backX + tank.backWidth;
                const rightBackY = tank.waterLevelTopBack + y * TANK_CONSTANTS.BACK_SCALE;
                
                const rightX1 = lerp(rightFrontX, rightBackX, rightDepthRatio);
                const rightY1 = lerp(rightFrontY, rightBackY, rightDepthRatio);
                const rightX2 = lerp(rightFrontX, rightBackX, rightNextDepthRatio);
                const rightY2 = lerp(rightFrontY, rightBackY, rightNextDepthRatio);
                
                const rightBottomY1 = lerp(rightFrontY + this.squareSize, rightBackY + this.squareSize * TANK_CONSTANTS.BACK_SCALE, rightDepthRatio);
                const rightBottomY2 = lerp(rightFrontY + this.squareSize, rightBackY + this.squareSize * TANK_CONSTANTS.BACK_SCALE, rightNextDepthRatio);
                
                quad(rightX1, rightY1, rightX2, rightY2, rightX2, rightBottomY2, rightX1, rightBottomY1);
                break;
        }
    }
} 