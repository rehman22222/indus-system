module.exports = {
  preset: '@react-native/jest-preset',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  modulePathIgnorePatterns: ['<rootDir>/APP/'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.js(x)?$': 'babel-jest',
    '^.+\\.ts(x)?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [],
  setupFilesAfterEnv: [
    "@testing-library/jest-native/extend-expect"
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.svg': '<rootDir>/__mocks__/svgMock.js',
  },
};
