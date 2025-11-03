// jest.config.js
// =============================================================================
// JEST CONFIGURATION - HOTEL CHECK-IN APPLICATION
// =============================================================================
// Production-grade Jest configuration for TypeScript testing with comprehensive
// coverage requirements, proper module resolution, and optimized test execution.
//
// Configuration Strategy:
// - ts-jest preset for TypeScript support with ESM compatibility
// - Node environment for backend API testing
// - Strict coverage thresholds (90% across all metrics)
// - Module path mapping aligned with tsconfig.json
// - Optimized test execution with parallel workers
// - Comprehensive ignore patterns for non-test code
// =============================================================================

export default {
  // =============================================================================
  // PRESET AND ENVIRONMENT CONFIGURATION
  // =============================================================================
  
  /**
   * ts-jest preset for TypeScript transformation
   * Provides out-of-the-box TypeScript support with proper type checking
   */
  preset: 'ts-jest',
  
  /**
   * Node.js test environment for backend API testing
   * Provides Node.js globals and APIs (no DOM)
   */
  testEnvironment: 'node',
  
  /**
   * Root directory for test discovery and module resolution
   * All paths are relative to this directory
   */
  rootDir: '.',
  
  // =============================================================================
  // TEST FILE DISCOVERY
  // =============================================================================
  
  /**
   * Test file patterns for discovery
   * Matches:
   * - src/**\/*.test.ts
   * - src/**\/*.spec.ts
   * - __tests__/**\/*.ts
   */
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.ts',
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.spec.ts',
  ],
  
  /**
   * Paths to ignore during test discovery
   * Excludes build artifacts, dependencies, and generated files
   */
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.tsbuildinfo',
    '/coverage/',
  ],
  
  // =============================================================================
  // MODULE RESOLUTION AND TRANSFORMATION
  // =============================================================================
  
  /**
   * Module name mapping for path aliases
   * Aligns with tsconfig.json paths configuration
   * Enables clean imports: import { User } from '@/models/user'
   */
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  /**
   * File extensions to consider as modules
   * Supports TypeScript and JavaScript files
   */
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  /**
   * TypeScript transformation configuration
   * Uses ts-jest for TypeScript compilation during tests
   */
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        /**
         * ts-jest configuration options
         * - useESM: Enable ESM support for modern module syntax
         * - tsconfig: Use test-specific TypeScript configuration
         */
        useESM: true,
        tsconfig: {
          // Override tsconfig for test environment
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          moduleResolution: 'node',
          module: 'ESNext',
          target: 'ES2022',
        },
      },
    ],
  },
  
  /**
   * Enable ESM support in Jest
   * Required for ES module syntax (import/export)
   */
  extensionsToTreatAsEsm: ['.ts'],
  
  // =============================================================================
  // COVERAGE CONFIGURATION
  // =============================================================================
  
  /**
   * Enable coverage collection
   * Generates coverage reports during test execution
   */
  collectCoverage: false, // Enable with --coverage flag
  
  /**
   * Files to include in coverage collection
   * Includes all TypeScript source files except:
   * - Test files (*.test.ts, *.spec.ts)
   * - Type definition files (*.d.ts)
   * - Configuration files
   * - Entry points (server.ts, index.ts)
   */
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/__tests__/**',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/index.ts',
    '!src/**/*.config.ts',
  ],
  
  /**
   * Coverage output directory
   * Stores HTML, JSON, and text coverage reports
   */
  coverageDirectory: 'coverage',
  
  /**
   * Coverage report formats
   * - text: Console output for CI/CD
   * - lcov: Standard format for coverage tools
   * - html: Interactive HTML report for developers
   * - json: Machine-readable format for tooling
   */
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  
  /**
   * Strict coverage thresholds (90% minimum)
   * Enforces high test coverage across all metrics
   * Fails CI/CD pipeline if thresholds not met
   * 
   * Metrics:
   * - branches: Conditional branches (if/else, switch, ternary)
   * - functions: Function and method coverage
   * - lines: Executable line coverage
   * - statements: Statement coverage
   */
  coverageThresholds: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  
  // =============================================================================
  // TEST EXECUTION CONFIGURATION
  // =============================================================================
  
  /**
   * Maximum number of worker processes
   * Uses 50% of available CPU cores for parallel test execution
   * Optimizes test performance while preventing resource exhaustion
   */
  maxWorkers: '50%',
  
  /**
   * Global test timeout (10 seconds)
   * Prevents hanging tests from blocking CI/CD pipeline
   * Individual tests can override with jest.setTimeout()
   */
  testTimeout: 10000,
  
  /**
   * Clear mock state between tests
   * Prevents test pollution and ensures test isolation
   * Automatically resets all mocks after each test
   */
  clearMocks: true,
  
  /**
   * Reset mock state between tests
   * Clears mock implementation and return values
   * More thorough than clearMocks
   */
  resetMocks: true,
  
  /**
   * Restore original implementations after tests
   * Ensures mocked modules don't affect subsequent tests
   * Most thorough cleanup option
   */
  restoreMocks: true,
  
  // =============================================================================
  // SETUP AND TEARDOWN
  // =============================================================================
  
  /**
   * Setup files executed after test framework initialization
   * Runs before each test file
   * Use for:
   * - Global test utilities
   * - Custom matchers
   * - Environment setup
   * - Mock configurations
   */
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  /**
   * Global setup module (runs once before all tests)
   * Use for:
   * - Database initialization
   * - Test server startup
   * - Global resource allocation
   */
  // globalSetup: '<rootDir>/jest.global.setup.js',
  
  /**
   * Global teardown module (runs once after all tests)
   * Use for:
   * - Database cleanup
   * - Test server shutdown
   * - Global resource deallocation
   */
  // globalTeardown: '<rootDir>/jest.global.teardown.js',
  
  // =============================================================================
  // OUTPUT AND REPORTING
  // =============================================================================
  
  /**
   * Verbose output for detailed test results
   * Shows individual test names and execution times
   * Helpful for debugging and CI/CD logs
   */
  verbose: true,
  
  /**
   * Disable console output during tests
   * Keeps test output clean and focused
   * Console logs still appear in failed test output
   */
  silent: false,
  
  /**
   * Error handling configuration
   * Bail after first test failure (disabled for comprehensive results)
   */
  bail: 0,
  
  /**
   * Notify on completion (disabled for CI/CD compatibility)
   * Enable locally for desktop notifications
   */
  notify: false,
  
  // =============================================================================
  // WATCH MODE CONFIGURATION
  // =============================================================================
  
  /**
   * Watch mode ignore patterns
   * Prevents unnecessary test reruns on file changes
   */
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/.git/',
  ],
  
  /**
   * Watch plugins for enhanced watch mode experience
   * Uncomment to enable:
   * - jest-watch-typeahead: Fuzzy search for test files and names
   */
  // watchPlugins: [
  //   'jest-watch-typeahead/filename',
  //   'jest-watch-typeahead/testname',
  // ],
  
  // =============================================================================
  // PERFORMANCE OPTIMIZATION
  // =============================================================================
  
  /**
   * Cache directory for faster subsequent runs
   * Stores transformed modules and test results
   */
  cacheDirectory: '<rootDir>/.jest-cache',
  
  /**
   * Detect open handles (disabled for performance)
   * Enable for debugging hanging tests
   */
  detectOpenHandles: false,
  
  /**
   * Force exit after tests complete (disabled)
   * Enable if tests hang due to open handles
   */
  forceExit: false,
  
  // =============================================================================
  // PRISMA AND DATABASE TESTING SUPPORT
  // =============================================================================
  
  /**
   * Module directories for dependency resolution
   * Includes node_modules and Prisma client location
   */
  moduleDirectories: ['node_modules', '<rootDir>'],
  
  /**
   * Globals configuration
   * Provides TypeScript type information to ts-jest
   */
  globals: {
    'ts-jest': {
      isolatedModules: true, // Faster compilation, skips type checking
    },
  },
};

// =============================================================================
// CONFIGURATION NOTES AND BEST PRACTICES
// =============================================================================
//
// 1. COVERAGE THRESHOLDS:
//    - 90% threshold enforces high-quality test coverage
//    - Adjust per-directory thresholds if needed for legacy code
//    - Use --coverage flag to generate reports: npm test -- --coverage
//
// 2. TEST ISOLATION:
//    - clearMocks, resetMocks, restoreMocks ensure clean test state
//    - Each test should be independent and repeatable
//    - Use beforeEach/afterEach for test-specific setup/teardown
//
// 3. TYPESCRIPT SUPPORT:
//    - ts-jest handles TypeScript compilation automatically
//    - ESM support enabled for modern module syntax
//    - Type checking can be enabled/disabled via isolatedModules
//
// 4. PERFORMANCE:
//    - maxWorkers='50%' balances speed and resource usage
//    - Caching enabled for faster subsequent runs
//    - Consider --maxWorkers=1 for debugging flaky tests
//
// 5. DATABASE TESTING:
//    - Use jest.setup.js for Prisma client initialization
//    - Implement transaction rollback pattern for test isolation
//    - Consider separate test database or in-memory SQLite
//
// 6. CI/CD INTEGRATION:
//    - Coverage reports in multiple formats for tool compatibility
//    - Verbose output for detailed CI logs
//    - Strict thresholds fail pipeline on insufficient coverage
//
// 7. WATCH MODE:
//    - Use npm test -- --watch for development
//    - Install jest-watch-typeahead for better UX
//    - Configure watchPathIgnorePatterns to avoid unnecessary reruns
//
// 8. DEBUGGING:
//    - Enable detectOpenHandles to find hanging tests
//    - Use --runInBand to run tests serially for debugging
//    - Add console.log statements (visible in failed test output)
//
// 9. AUTHENTICATION TESTING:
//    - Mock JWT token generation for consistent test data
//    - Use fixed bcrypt salt rounds for deterministic hashing
//    - Test both success and failure authentication flows
//
// 10. SECURITY TESTING:
//     - Test input validation and sanitization
//     - Verify password hashing (never store plain text)
//     - Test authorization checks for protected routes
//     - Validate JWT token expiration and refresh logic
//
// =============================================================================