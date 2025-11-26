module.exports = {
    testEnvironment: 'node',
    testMatch: [
        "**/__tests__/**/*.test.js"
    ],
    testPathIgnorePatterns: [
        "/node_modules/"
    ],
    coveragePathIgnorePatterns: [
        "/node_modules/"
    ],
    globals: {
        "NODE_ENV": "test"
    },
};
