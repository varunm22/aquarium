class Vector {
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
  
    // Scalar multiplication
    multiply(scalar) {
      return new Vector(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    // Scalar division
    divide(scalar) {
      if (scalar === 0) {
        throw new Error("Division by zero is not allowed.");
      }
      return new Vector(this.x / scalar, this.y / scalar, this.z / scalar);
    }
  
    // Element-wise addition
    add(other) {
      return new Vector(this.x + other.x, this.y + other.y, this.z + other.z);
    }
  
    // Element-wise subtraction
    subtract(other) {
      return new Vector(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    dotProduct(other) {
      return this.x * other.x + this.y * other.y + this.z * other.z;
    }

    constrainScalar(min, max) {
      const x = Math.max(min, Math.min(this.x, max));
      const y = Math.max(min, Math.min(this.y, max));
      const z = Math.max(min, Math.min(this.z, max));
      return new Vector(x, y, z);
    }
    
    constrainVector(min, max) {
      const x = Math.max(min.x, Math.min(this.x, max.x));
      const y = Math.max(min.y, Math.min(this.y, max.y));
      const z = Math.max(min.z, Math.min(this.z, max.z));
      return new Vector(x, y, z);
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

    print() {
        console.log(`Vector(x: ${this.x}, y: ${this.y}, z: ${this.z})`);
      }
  }
  