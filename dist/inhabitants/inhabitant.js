export class Inhabitant {
    constructor(position, size) {
        this.position = position;
        this.size = size;
    }
    distanceTo(other) {
        return this.position.value.distanceTo(other.position.value);
    }
    isInFieldOfView(other, maxAngle = 45, maxDistance = 200) {
        const disp = other.position.value.subtract(this.position.value);
        const distance = this.distanceTo(other);
        const disp_norm = disp.divide(disp.magnitude());
        const fish_dir = this.position.delta.divide(this.position.delta.magnitude());
        const dotProduct = disp_norm.dotProduct(fish_dir);
        const angle = Math.acos(dotProduct);
        return degrees(angle) <= maxAngle && distance <= maxDistance;
    }
    update(_inhabitants = []) {
        this.position.update();
    }
    render(tank, color) {
        const { x: renderX, y: renderY, depthScale } = tank.getRenderPosition(this.position.value);
        fill(color);
        noStroke();
        ellipse(renderX, renderY, this.size * depthScale, this.size * depthScale);
    }
}
