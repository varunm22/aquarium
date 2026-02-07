export class Vector {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    static random(min, max) {
        const randomValue = () => Math.random() * (max - min) + min;
        return new Vector(randomValue(), randomValue(), randomValue());
    }
    static zero() {
        return new Vector(0, 0, 0);
    }
    multiply(scalar) {
        return new Vector(this.x * scalar, this.y * scalar, this.z * scalar);
    }
    multiplyInPlace(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }
    divide(scalar) {
        if (scalar === 0)
            throw new Error("Division by zero is not allowed.");
        return new Vector(this.x / scalar, this.y / scalar, this.z / scalar);
    }
    divideInPlace(scalar) {
        if (scalar === 0)
            throw new Error("Division by zero is not allowed.");
        this.x /= scalar;
        this.y /= scalar;
        this.z /= scalar;
        return this;
    }
    add(other) {
        return new Vector(this.x + other.x, this.y + other.y, this.z + other.z);
    }
    addInPlace(other) {
        this.x += other.x;
        this.y += other.y;
        this.z += other.z;
        return this;
    }
    subtract(other) {
        return new Vector(this.x - other.x, this.y - other.y, this.z - other.z);
    }
    subtractInPlace(other) {
        this.x -= other.x;
        this.y -= other.y;
        this.z -= other.z;
        return this;
    }
    dotProduct(other) {
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }
    constrainScalar(min, max) {
        return new Vector(Math.max(min, Math.min(this.x, max)), Math.max(min, Math.min(this.y, max)), Math.max(min, Math.min(this.z, max)));
    }
    constrainVector(min, max) {
        return new Vector(Math.max(min.x, Math.min(this.x, max.x)), Math.max(min.y, Math.min(this.y, max.y)), Math.max(min.z, Math.min(this.z, max.z)));
    }
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dz = this.z - other.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    copy() {
        return new Vector(this.x, this.y, this.z);
    }
    normalize() {
        const len = this.magnitude();
        if (len > 0) {
            this.x /= len;
            this.y /= len;
            this.z /= len;
        }
        return this;
    }
}
