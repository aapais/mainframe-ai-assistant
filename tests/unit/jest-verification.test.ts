/**
 * Jest Configuration Verification Test
 * This test verifies that Jest is properly configured and can run tests successfully
 */

describe('Jest Configuration', () => {
  it('should run tests successfully', () => {
    expect(true).toBe(true);
  });

  it('should support TypeScript', () => {
    const message: string = 'TypeScript support is working';
    expect(message).toBe('TypeScript support is working');
  });

  it('should support async/await', async () => {
    const asyncFunction = async (): Promise<string> => {
      return 'async works';
    };

    const result = await asyncFunction();
    expect(result).toBe('async works');
  });

  it('should support modern JavaScript features', () => {
    const array = [1, 2, 3, 4, 5];
    const doubled = array.map(x => x * 2);
    const evens = doubled.filter(x => x % 2 === 0);

    expect(evens).toEqual([2, 4, 6, 8, 10]);
  });

  it('should support object destructuring', () => {
    const obj = { name: 'Test', value: 42 };
    const { name, value } = obj;

    expect(name).toBe('Test');
    expect(value).toBe(42);
  });

  it('should support array destructuring', () => {
    const arr = ['first', 'second', 'third'];
    const [first, second] = arr;

    expect(first).toBe('first');
    expect(second).toBe('second');
  });

  it('should support template literals', () => {
    const name = 'Jest';
    const message = `Hello, ${name}!`;

    expect(message).toBe('Hello, Jest!');
  });

  it('should support classes', () => {
    class TestClass {
      private value: number;

      constructor(value: number) {
        this.value = value;
      }

      getValue(): number {
        return this.value;
      }
    }

    const instance = new TestClass(42);
    expect(instance.getValue()).toBe(42);
  });

  it('should support promises', async () => {
    const promise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('promise resolved'), 10);
    });

    const result = await promise;
    expect(result).toBe('promise resolved');
  });

  it('should support error handling', () => {
    const throwError = (): never => {
      throw new Error('Test error');
    };

    expect(throwError).toThrow('Test error');
  });
});