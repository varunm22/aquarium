import { TANK_CONSTANTS } from '../constants.js';
export class Algae {
    // Removed chunked rendering variables to eliminate flickering
    constructor() {
        this.squareSize = 4;
        this.newGrowthChance = 0.01; // 1% chance per frame for new algae
        this.spreadChance = 0.001; // 1% chance per frame for spreading
        this.levelUpChance = 0.0001; // 1% chance per frame for level 1 to become level 2
        // Active set tracking - only cells with algae (using numeric encoding for speed)
        this.activeCells = new Set(); // Encoded as: wallIndex * 1000000 + x * 1000 + y
        this.wallIndices = { 'front': 0, 'back': 1, 'left': 2, 'right': 3 };
        this.wallNames = ['front', 'back', 'left', 'right'];
        // Batch processing - sample 0.1% of active cells per frame
        this.samplingRate = 0.001; // Process 0.1% of active cells per frame
        this.probabilityScale = 100; // Scale probabilities by 100x to compensate
        this.activeCellsArray = []; // Pre-allocated array to avoid Array.from() every frame
        // Pre-generated random numbers for performance
        this.randomPool = [];
        this.randomIndex = 0;
        this.RANDOM_POOL_SIZE = 1000;
        // Algae hotspot tracking for snail navigation
        this.algaeHotspots = [];
        this.frameCounter = 0; // Add frame counter for more controlled updates
        this.lastHotspotUpdateFrame = 0; // Track when hotspots were last updated
        this.calculateWallDimensions();
        this.initializeWallGrids();
        this.refillRandomPool();
        this.cleanupActiveCells();
        this.updateAlgaeHotspots(); // Initial hotspot calculation
    }
    // Clean up any invalid cells that might be in the active set
    cleanupActiveCells() {
        const invalidCells = [];
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
    encodeCell(wall, x, y) {
        // Validate inputs to prevent NaN
        if (isNaN(x) || isNaN(y) || !this.wallIndices.hasOwnProperty(wall)) {
            console.warn('Invalid coordinates in encodeCell:', wall, x, y);
            return -1; // Invalid encoding
        }
        return this.wallIndices[wall] * 1000000 + x * 1000 + y;
    }
    decodeCell(encoded) {
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
    refillRandomPool() {
        this.randomPool.length = 0;
        for (let i = 0; i < this.RANDOM_POOL_SIZE; i++) {
            this.randomPool.push(random());
        }
        this.randomIndex = 0;
    }
    fastRandom() {
        if (this.randomIndex >= this.randomPool.length) {
            this.refillRandomPool();
        }
        return this.randomPool[this.randomIndex++];
    }
    calculateWallDimensions() {
        // Algae grows from water level to gravel level (not tank bottom)
        const waterLevelTop = TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT;
        const gravelLevel = TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT - TANK_CONSTANTS.GRAVEL_HEIGHT;
        const totalHeight = gravelLevel - waterLevelTop;
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
    initializeWallGrids() {
        this.wallGrids = {
            front: Array(this.wallDimensions.front.gridCols).fill(null).map(() => Array(this.wallDimensions.front.gridRows).fill(0)),
            back: Array(this.wallDimensions.back.gridCols).fill(null).map(() => Array(this.wallDimensions.back.gridRows).fill(0)),
            left: Array(this.wallDimensions.left.gridCols).fill(null).map(() => Array(this.wallDimensions.left.gridRows).fill(0)),
            right: Array(this.wallDimensions.right.gridCols).fill(null).map(() => Array(this.wallDimensions.right.gridRows).fill(0))
        };
    }
    update() {
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
    }
    growAlgae() {
        // Choose a random wall
        const walls = ['front', 'back', 'left', 'right'];
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
    processExistingAlgae() {
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
    spreadToAdjacent(wall, x, y) {
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
    getAdjacentPositions(wall, x, y) {
        const positions = [];
        const wallDim = this.wallDimensions[wall];
        // Check all 4 adjacent positions (up, down, left, right)
        const adjacentOffsets = [
            { dx: 0, dy: -1 }, // up
            { dx: 0, dy: 1 }, // down
            { dx: -1, dy: 0 }, // left
            { dx: 1, dy: 0 } // right
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
    addCrossWallConnections(wall, x, y, positions) {
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
    render(tank) {
        // Render all algae squares (excluding front wall which is rendered separately)
        for (const encodedCell of this.activeCells) {
            const decodedCell = this.decodeCell(encodedCell);
            if (!decodedCell)
                continue;
            const { wall, x, y } = decodedCell;
            // Skip front wall (rendered separately)
            if (wall === 'front')
                continue;
            const level = this.wallGrids[wall][x][y];
            if (level > 0) {
                this.renderSquare(tank, wall, x, y, level);
            }
        }
    }
    renderFrontWall(tank) {
        // Render all front wall algae squares
        for (const encodedCell of this.activeCells) {
            const decodedCell = this.decodeCell(encodedCell);
            if (!decodedCell)
                continue;
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
    getAlgaeLevel(wall, wallX, wallY) {
        const gridCoords = this.wallToGridCoordinates(wall, wallX, wallY);
        if (!gridCoords)
            return 0;
        const wallDim = this.wallDimensions[wall];
        if (gridCoords.gridX < 0 || gridCoords.gridX >= wallDim.gridCols ||
            gridCoords.gridY < 0 || gridCoords.gridY >= wallDim.gridRows) {
            return 0;
        }
        return this.wallGrids[wall][gridCoords.gridX][gridCoords.gridY];
    }
    removeAlgae(wall, wallX, wallY) {
        const gridCoords = this.wallToGridCoordinates(wall, wallX, wallY);
        if (!gridCoords)
            return;
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
    // Convert 2D wall coordinates to grid coordinates
    wallToGridCoordinates(wall, wallX, wallY) {
        const waterLevelTop = TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT;
        // For all walls, wallY represents the actual Y coordinate in world space
        // wallX represents different things based on the wall:
        // - front/back walls: wallX = world X coordinate  
        // - left/right walls: wallX = world Z coordinate
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
    worldToGridCoordinates(wall, worldX, worldY, worldZ) {
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
    updateAlgaeHotspots() {
        // Check if we've updated recently (less than 50 frames ago)
        if (this.frameCounter - this.lastHotspotUpdateFrame < 50) {
            return; // Don't recompute if updated recently
        }
        this.lastHotspotUpdateFrame = this.frameCounter;
        this.algaeHotspots = [];
        const regionSize = 40; // Group algae into 40x40 pixel regions
        const overlap = 20; // Overlap by 20 pixels
        const stepSize = regionSize - overlap; // Step by 20 pixels to create overlapping regions
        // Simple approach: generate overlapping regions and count algae in each
        const hotspots = this.generateOverlappingHotspots(regionSize, stepSize);
        this.algaeHotspots = hotspots
            .filter(hotspot => hotspot.strength > 0) // Exclude hotspots with 0 algae
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 10); // Limit to top 10 hotspots
    }
    // Public method to request hotspot update (called by snails)
    requestHotspotUpdate() {
        this.updateAlgaeHotspots();
    }
    getAlgaeHotspots() {
        return this.algaeHotspots;
    }
    worldToGridCoordinatesPublic(wall, worldX, worldY, worldZ) {
        return this.worldToGridCoordinates(wall, worldX, worldY, worldZ);
    }
    getWallDimensions() {
        return this.wallDimensions;
    }
    getWallGrids() {
        return this.wallGrids;
    }
    generateOverlappingHotspots(regionSize, stepSize) {
        const hotspots = [];
        // Convert world space regions to grid space
        // regionSize of 40 pixels / squareSize of 4 = 10 grid squares
        // stepSize of 20 pixels / squareSize of 4 = 5 grid squares
        const gridRegionSize = Math.ceil(regionSize / this.squareSize); // 10 grid squares
        const gridStepSize = Math.ceil(stepSize / this.squareSize); // 5 grid squares
        // Generate overlapping regions for each wall directly in grid coordinates
        for (const wall of ['front', 'back', 'left', 'right']) {
            const wallDim = this.wallDimensions[wall];
            // Iterate through grid coordinates directly
            for (let gridX = 0; gridX < wallDim.gridCols; gridX += gridStepSize) {
                for (let gridY = 0; gridY < wallDim.gridRows; gridY += gridStepSize) {
                    // Count algae in this grid region
                    const regionStrength = this.countAlgaeInGridRegion(wall, gridX, gridY, gridRegionSize);
                    if (regionStrength > 0) {
                        // Convert grid center back to world coordinates for the hotspot
                        const centerGridX = gridX + gridRegionSize / 2;
                        const centerGridY = gridY + gridRegionSize / 2;
                        const worldCenter = this.gridToWorldCoordinates(wall, centerGridX, centerGridY);
                        if (worldCenter) {
                            // Map coordinates to snail's goal coordinate system
                            let goalX, goalY;
                            if (wall === 'left' || wall === 'right') {
                                // For left/right walls: goal.x = Z-coordinate, goal.y = Y-coordinate
                                goalX = worldCenter.z;
                                goalY = worldCenter.y;
                            }
                            else {
                                // For front/back walls: goal.x = X-coordinate, goal.y = Y-coordinate
                                goalX = worldCenter.x;
                                goalY = worldCenter.y;
                            }
                            hotspots.push({
                                wall,
                                centerX: goalX,
                                centerY: goalY,
                                centerZ: worldCenter.z,
                                strength: regionStrength,
                                count: 0 // We'll calculate this if needed
                            });
                        }
                    }
                }
            }
        }
        return hotspots;
    }
    renderSquare(tank, wall, gridX, gridY, level) {
        const alpha = level * 0.1;
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
    countAlgaeInGridRegion(wall, startGridX, startGridY, gridRegionSize) {
        let totalStrength = 0;
        const wallDim = this.wallDimensions[wall];
        // Check all grid cells within the region
        for (let gridX = startGridX; gridX < Math.min(startGridX + gridRegionSize, wallDim.gridCols); gridX++) {
            for (let gridY = startGridY; gridY < Math.min(startGridY + gridRegionSize, wallDim.gridRows); gridY++) {
                if (gridX >= 0 && gridX < wallDim.gridCols && gridY >= 0 && gridY < wallDim.gridRows) {
                    const level = this.wallGrids[wall][gridX][gridY];
                    totalStrength += level;
                }
            }
        }
        return totalStrength;
    }
    gridToWorldCoordinates(wall, gridX, gridY) {
        const waterLevelTop = TANK_CONSTANTS.Y + TANK_CONSTANTS.HEIGHT * TANK_CONSTANTS.WATER_LEVEL_PERCENT;
        // Convert grid coordinates back to world coordinates
        const worldX = gridX * this.squareSize;
        const worldY = gridY * this.squareSize + waterLevelTop;
        switch (wall) {
            case 'front':
                return {
                    x: worldX + TANK_CONSTANTS.X,
                    y: worldY,
                    z: TANK_CONSTANTS.MIN_Z + 5
                };
            case 'back':
                return {
                    x: worldX + TANK_CONSTANTS.X,
                    y: worldY,
                    z: TANK_CONSTANTS.DEPTH - 5
                };
            case 'left':
                return {
                    x: TANK_CONSTANTS.X + 5,
                    y: worldY,
                    z: worldX + TANK_CONSTANTS.MIN_Z
                };
            case 'right':
                return {
                    x: TANK_CONSTANTS.X + TANK_CONSTANTS.WIDTH - 5,
                    y: worldY,
                    z: worldX + TANK_CONSTANTS.MIN_Z
                };
        }
    }
}
