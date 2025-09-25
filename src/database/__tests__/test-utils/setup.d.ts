declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toHaveExecutedWithin(maxMs: number): R;
    }
  }
}
export {};
//# sourceMappingURL=setup.d.ts.map
