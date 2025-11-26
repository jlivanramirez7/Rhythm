module.exports = {
    ...require('./jest.config'), // Inherit from the base config
    setupFilesAfterEnv: ['./__tests__/setup-pg.js'],
    testPathIgnorePatterns: [
        "/node_modules/",
        "/__tests__/ui.test.js"
    ],
};
