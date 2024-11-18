function setup() {
  createCanvas(1000, 800); // Larger canvas for the tank
  noLoop(); // We only need to draw the tank once
}

function draw() {
  background(255); // White background for contrast

  // Front face of the tank
  const frontX = 150;
  const frontY = 150;
  const frontWidth = 700; // Wider tank
  const frontHeight = 500; // Taller tank

  // Scaling factor for the back pane (smaller than front pane)
  const scaleFactor = 0.7;

  // Calculate dimensions and position of the back pane
  const backWidth = frontWidth * scaleFactor;
  const backHeight = frontHeight * scaleFactor;
  const backX = frontX + (frontWidth - backWidth) / 2; // Center horizontally
  const backY = frontY + (frontHeight - backHeight) / 2; // Center vertically

  // Define water level (10% below top)
  const waterLevelTopFront = frontY + frontHeight * 0.1; // Front pane water level
  const waterLevelTopBack = backY + backHeight * 0.1; // Back pane water level

  // Draw the tank outlines (fully opaque)
  // Top horizontal connecting lines (thick)
  stroke(0); // Solid black
  strokeWeight(10); // Thicker lines for horizontal edges
  line(frontX, frontY, backX, backY); // Top-left
  line(frontX + frontWidth, frontY, backX + backWidth, backY); // Top-right

  // Bottom horizontal connecting lines (thick)
  line(frontX, frontY + frontHeight, backX, backY + backHeight); // Bottom-left
  line(frontX + frontWidth, frontY + frontHeight, backX + backWidth, backY + backHeight); // Bottom-right

  // Vertical side connecting lines (thin)
  strokeWeight(5); // Thinner lines for vertical edges
  line(frontX, frontY, frontX, frontY + frontHeight); // Front-left vertical
  line(frontX + frontWidth, frontY, frontX + frontWidth, frontY + frontHeight); // Front-right vertical
  line(backX, backY, backX, backY + backHeight); // Back-left vertical
  line(backX + backWidth, backY, backX + backWidth, backY + backHeight); // Back-right vertical

  // Back pane outline
  strokeWeight(10); // Thicker horizontal edges for the back pane
  line(backX, backY, backX + backWidth, backY); // Back top horizontal
  line(backX, backY + backHeight, backX + backWidth, backY + backHeight); // Back bottom horizontal

  strokeWeight(5); // Thinner vertical edges for the back pane
  line(backX, backY, backX, backY + backHeight); // Back left vertical
  line(backX + backWidth, backY, backX + backWidth, backY + backHeight); // Back right vertical

  // Front pane outline
  strokeWeight(10); // Thicker horizontal edges for the front pane
  line(frontX, frontY, frontX + frontWidth, frontY); // Front top horizontal
  line(frontX, frontY + frontHeight, frontX + frontWidth, frontY + frontHeight); // Front bottom horizontal

  strokeWeight(5); // Thinner vertical edges for the front pane
  line(frontX, frontY, frontX, frontY + frontHeight); // Front left vertical
  line(frontX + frontWidth, frontY, frontX + frontWidth, frontY + frontHeight); // Front right vertical

  // Draw the water level line
  strokeWeight(2); // Thin water level line
  line(frontX, waterLevelTopFront, frontX + frontWidth, waterLevelTopFront); // Front water level line
  line(backX, waterLevelTopBack, backX + backWidth, waterLevelTopBack); // Back water level line
  line(frontX, waterLevelTopFront, backX, waterLevelTopBack); // Left side water level line
  line(frontX + frontWidth, waterLevelTopFront, backX + backWidth, waterLevelTopBack); // Right side water level line

  // Draw the water layers (after the outlines)
  const numLayers = 20; // Finite number of layers
  for (let i = 0; i < numLayers; i++) {
    const interp = i / numLayers; // Interpolation factor

    // Calculate water layer bounds
    const layerX = lerp(frontX, backX, interp);
    const layerYTop = lerp(waterLevelTopFront, waterLevelTopBack, interp); // Water starts 10% below top
    const layerYBottom = lerp(frontY + frontHeight, backY + backHeight, interp); // Water ends at bottom
    const layerWidth = lerp(frontWidth, backWidth, interp);
    const layerHeight = layerYBottom - layerYTop; // Adjust height to fit within the tank

    // Adjust alpha for water transparency
    const alpha = map(i, 0, numLayers, 30, 0); // Front starts at 30, back becomes fully transparent

    // Draw the layer
    fill(173, 216, 230, alpha); // Light blue color (RGB: 173, 216, 230)
    noStroke();
    rect(layerX, layerYTop, layerWidth, layerHeight);
  }
}