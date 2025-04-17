export class Inhabitant {
    constructor(position, size) {
        this.position = position;
        this.size = size;
    }
    distanceTo(other) {
        return this.position.value.distanceTo(other.position.value);
    }
    moveTowards(other, maxSpeed = 1, multiplier = 1) {
        this.position.delta = this.position.delta.add(other.position.value.subtract(this.position.value).multiply(multiplier * 0.0001)).constrainScalar(-maxSpeed, maxSpeed);
    }
    moveFrom(other, maxSpeed = 1, multiplier = 1) {
        let diff_vector = other.position.value.subtract(this.position.value);
        this.position.delta = this.position.delta.subtract(diff_vector.multiply(multiplier).divide(Math.pow(diff_vector.magnitude(), 2) * 10)).constrainScalar(-maxSpeed, maxSpeed);
    }
    isInFieldOfView(other, maxAngle = 45, maxDistance = 200) {
        // Direction vector from the current fish to the other
        const disp = other.position.value.subtract(this.position.value);
        // Calculate the 3D distance
        const distance = this.distanceTo(other);
        // Normalize the direction vector
        const disp_norm = disp.divide(disp.magnitude());
        // Dot product between the fish's facing direction and the direction to the other fish
        const fish_dir = this.position.delta.divide(this.position.delta.magnitude());
        const dotProduct = disp_norm.dotProduct(fish_dir);
        // Angle between the vectors
        const angle = Math.acos(dotProduct); // Angle between the vectors in radians
        const angleDegrees = degrees(angle); // Convert to degrees
        // Return true if the fish is within the angle and distance threshold
        return angleDegrees <= maxAngle && distance <= maxDistance;
    }
    update(inhabitants = []) {
        // Update position based on velocity
        this.position.update();
    }
    render(tank, color) {
        // Interpolate 2D position based on depth
        const relativeDepth = this.position.z / tank.depth;
        const renderX = lerp(tank.x, tank.backX, relativeDepth) + (this.position.x - tank.x) * lerp(1, 0.7, relativeDepth);
        const renderY = lerp(tank.y, tank.backY, relativeDepth) + (this.position.y - tank.y) * lerp(1, 0.7, relativeDepth);
        // Scale size based on depth
        const renderSize = this.size * lerp(1, 0.7, relativeDepth);
        // Render the inhabitant
        fill(color); // Use the given color
        noStroke();
        ellipse(renderX, renderY, renderSize, renderSize); // Render as a circle
    }
}
