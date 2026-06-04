module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.js(x)?$': 'babel-jest',
    '^.+\\.ts(x)?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [],
  setupFiles: ['react-native/jest/setup'],
  setupFilesAfterEnv: [
    "@testing-library/jest-native/extend-expect"
  ],
  moduleNameMapper: {
    '\\.svg': '<rootDir>/__mocks__/svgMock.js',
  },
};
