export class Vector {
    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    }

    static random(min: number, max: number): Vector {
        const randomValue = () => Math.random() * (max - min) + min;
        return new Vector(randomValue(), randomValue(), randomValue());
    }

    static zero(): Vector {
        return new Vector(0, 0, 0);
    }
  
    // Scalar multiplication
    multiply(scalar: number): Vector {
      return new Vector(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    // In-place scalar multiplication
    multiplyInPlace(scalar: number): Vector {
      this.x *= scalar;
      this.y *= scalar;
      this.z *= scalar;
      return this;
    }

    // Scalar division
    divide(scalar: number): Vector {
      if (scalar === 0) {
        throw new Error("Division by zero is not allowed.");
      }
      return new Vector(this.x / scalar, this.y / scalar, this.z / scalar);
    }

    // In-place scalar division
    divideInPlace(scalar: number): Vector {
      if (scalar === 0) {
        throw new Error("Division by zero is not allowed.");
      }
      this.x /= scalar;
      this.y /= scalar;
      this.z /= scalar;
      return this;
    }
  
    // Element-wise addition
    add(other: Vector): Vector {
      return new Vector(this.x + other.x, this.y + other.y, this.z + other.z);
    }

    // In-place element-wise addition
    addInPlace(other: Vector): Vector {
      this.x += other.x;
      this.y += other.y;
      this.z += other.z;
      return this;
    }
  
    // Element-wise subtraction
    subtract(other: Vector): Vector {
      return new Vector(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    // In-place element-wise subtraction
    subtractInPlace(other: Vector): Vector {
      this.x -= other.x;
      this.y -= other.y;
      this.z -= other.z;
      return this;
    }

    dotProduct(other: Vector): number {
      return this.x * other.x + this.y * other.y + this.z * other.z;
    }

    constrainScalar(min: number, max: number): Vector {
      const x = Math.max(min, Math.min(this.x, max));
      const y = Math.max(min, Math.min(this.y, max));
      const z = Math.max(min, Math.min(this.z, max));
      return new Vector(x, y, z);
    }
    
    constrainVector(min: Vector, max: Vector): Vector {
      const x = Math.max(min.x, Math.min(this.x, max.x));
      const y = Math.max(min.y, Math.min(this.y, max.y));
      const z = Math.max(min.z, Math.min(this.z, max.z));
      return new Vector(x, y, z);
    }

    magnitude(): number {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    distanceTo(other: Vector): number {
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const dz = this.z - other.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    print(): void {
        console.log(`Vector(x: ${this.x}, y: ${this.y}, z: ${this.z})`);
    }
}
  