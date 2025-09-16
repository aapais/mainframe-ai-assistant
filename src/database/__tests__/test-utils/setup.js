"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const globals_1 = require("@jest/globals");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
const TestDatabaseFactory_1 = require("./TestDatabaseFactory");
(0, globals_1.beforeAll)(() => {
    const testDirs = [
        path_1.default.join(__dirname, '..', 'temp'),
        path_1.default.join(__dirname, '..', 'backups'),
        path_1.default.join(__dirname, '..', 'migrations')
    ];
    testDirs.forEach(dir => {
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
    });
});
(0, globals_1.afterAll)(async () => {
    await TestDatabaseFactory_1.TestDatabaseFactory.cleanup();
    const testDirs = [
        path_1.default.join(__dirname, '..', 'temp'),
        path_1.default.join(__dirname, '..', 'backups')
    ];
    testDirs.forEach(dir => {
        if (fs_1.default.existsSync(dir)) {
            fs_1.default.rmSync(dir, { recursive: true, force: true });
        }
    });
});
expect.extend({
    toBeWithinRange(received, floor, ceiling) {
        const pass = received >= floor && received <= ceiling;
        if (pass) {
            return {
                message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
                pass: true,
            };
        }
        else {
            return {
                message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
                pass: false,
            };
        }
    },
    toHaveExecutedWithin(received, maxMs) {
        const pass = received <= maxMs;
        if (pass) {
            return {
                message: () => `expected ${received}ms not to be within ${maxMs}ms`,
                pass: true,
            };
        }
        else {
            return {
                message: () => `expected ${received}ms to be within ${maxMs}ms but took ${received}ms`,
                pass: false,
            };
        }
    }
});
//# sourceMappingURL=setup.js.map