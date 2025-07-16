import assert from 'assert'
import { replaceEnvVariables, replaceEnvVariablesStrict } from '../../src/util/configuration'

describe('Environment Variable Configuration Utils', () => {
  describe('replaceEnvVariables', () => {
    it('should replace simple string environment variables', () => {
      const input = '${TEST_VAR}'
      const envVars = { TEST_VAR: 'test_value' }

      const result = replaceEnvVariables(input, envVars)

      assert.strictEqual(result, 'test_value')
    })

    it('should throw an error when environment variable is not found', () => {
      const input = '${MISSING_VAR}'
      const envVars = {}

      assert.throws(() => replaceEnvVariables(input, envVars), {
        message: 'Environment variable MISSING_VAR is not defined',
      })
    })

    it('should not replace strings that do not match the exact pattern', () => {
      const envVars = { TEST_VAR: 'test_value' }

      const testCases = [
        'prefix_${TEST_VAR}',
        '${TEST_VAR}_suffix',
        'prefix_${TEST_VAR}_suffix',
        '$TEST_VAR',
        '${TEST_VAR',
        'TEST_VAR}',
        '${TEST-VAR}', // hyphens not allowed
        '${123VAR}', // numbers at start not allowed
        '${}', // empty variable name
      ]

      testCases.forEach(testCase => {
        const result = replaceEnvVariables(testCase, envVars)
        assert.strictEqual(result, testCase, `Should not replace: ${testCase}`)
      })
    })

    it('should handle primitive types correctly', () => {
      const envVars = { TEST_VAR: 'test_value' }

      assert.strictEqual(replaceEnvVariables(42, envVars), 42)
      assert.strictEqual(replaceEnvVariables(true, envVars), true)
      assert.strictEqual(replaceEnvVariables(null, envVars), null)
      assert.strictEqual(replaceEnvVariables(undefined, envVars), undefined)
    })

    it('should replace environment variables in nested objects', () => {
      const input = {
        database: {
          host: '${DB_HOST}',
          port: '${DB_PORT}',
          config: {
            ssl: '${DB_SSL}',
            timeout: 5000,
          },
        },
        api: {
          key: '${API_KEY}',
        },
        staticValue: 'unchanged',
      }

      const envVars = {
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_SSL: 'true',
        API_KEY: 'secret123',
      }

      const result = replaceEnvVariables(input, envVars)

      const expected = {
        database: {
          host: 'localhost',
          port: '5432',
          config: {
            ssl: 'true',
            timeout: 5000,
          },
        },
        api: {
          key: 'secret123',
        },
        staticValue: 'unchanged',
      }

      assert.deepStrictEqual(result, expected)
    })

    it('should replace environment variables in arrays', () => {
      const input = [
        '${VAR_1}',
        '${VAR_2}',
        'static_value',
        42,
        {
          nested: '${VAR_3}',
          array: ['${VAR_4}', 'static'],
        },
      ]

      const envVars = {
        VAR_1: 'value1',
        VAR_2: 'value2',
        VAR_3: 'value3',
        VAR_4: 'value4',
      }

      const result = replaceEnvVariables(input, envVars)

      const expected = [
        'value1',
        'value2',
        'static_value',
        42,
        {
          nested: 'value3',
          array: ['value4', 'static'],
        },
      ]

      assert.deepStrictEqual(result, expected)
    })

    it('should handle complex nested structures', () => {
      const input = {
        services: [
          {
            name: 'database',
            config: {
              host: '${DB_HOST}',
              credentials: ['${DB_USER}', '${DB_PASS}'],
            },
          },
          {
            name: 'cache',
            config: {
              redis: {
                url: '${REDIS_URL}',
                options: {
                  retryDelayOnFailover: 100,
                  enableReadyCheck: '${REDIS_READY_CHECK}',
                },
              },
            },
          },
        ],
        features: {
          enabled: ['${FEATURE_A}', '${FEATURE_B}'],
          disabled: ['feature_c'],
        },
      }

      const envVars = {
        DB_HOST: 'db.example.com',
        DB_USER: 'admin',
        DB_PASS: 'secret123',
        REDIS_URL: 'redis://localhost:6379',
        REDIS_READY_CHECK: 'true',
        FEATURE_A: 'analytics',
        FEATURE_B: 'monitoring',
      }

      const result = replaceEnvVariables(input, envVars)

      assert.strictEqual((result as any).services[0].config.host, 'db.example.com')
      assert.deepStrictEqual((result as any).services[0].config.credentials, ['admin', 'secret123'])
      assert.strictEqual((result as any).services[1].config.redis.url, 'redis://localhost:6379')
      assert.strictEqual((result as any).services[1].config.redis.options.enableReadyCheck, 'true')
      assert.strictEqual((result as any).services[1].config.redis.options.retryDelayOnFailover, 100)
      assert.deepStrictEqual((result as any).features.enabled, ['analytics', 'monitoring'])
      assert.deepStrictEqual((result as any).features.disabled, ['feature_c'])
    })

    it('should use process.env by default', () => {
      // Set a test environment variable
      const originalValue = process.env.TEST_ENV_VAR
      process.env.TEST_ENV_VAR = 'from_process_env'

      try {
        const input = { test: '${TEST_ENV_VAR}' }
        const result = replaceEnvVariables(input)

        assert.strictEqual(result.test, 'from_process_env')
      } finally {
        // Clean up
        if (originalValue !== undefined) {
          process.env.TEST_ENV_VAR = originalValue
        } else {
          delete process.env.TEST_ENV_VAR
        }
      }
    })

    it('should handle empty objects and arrays', () => {
      const envVars = { TEST_VAR: 'test_value' }

      assert.deepStrictEqual(replaceEnvVariables({}, envVars), {})
      assert.deepStrictEqual(replaceEnvVariables([], envVars), [])
    })

    it('should not mutate the original object', () => {
      const input = {
        config: {
          value: '${TEST_VAR}',
        },
      }
      const envVars = { TEST_VAR: 'new_value' }

      const result = replaceEnvVariables(input, envVars)

      // Original should be unchanged
      assert.strictEqual(input.config.value, '${TEST_VAR}')
      // Result should be changed
      assert.strictEqual(result.config.value, 'new_value')
    })
  })

  describe('replaceEnvVariablesStrict', () => {
    it('should successfully replace variables when all required vars are present', () => {
      const input = {
        database: {
          host: '${DB_HOST}',
          port: '${DB_PORT}',
        },
      }

      const envVars = {
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        EXTRA_VAR: 'not_required',
      }

      const result = replaceEnvVariablesStrict(input, ['DB_HOST', 'DB_PORT'], envVars)

      assert.strictEqual(result.database.host, 'localhost')
      assert.strictEqual(result.database.port, '5432')
    })

    it('should throw error when required environment variables are missing', () => {
      const input = {
        database: {
          host: '${DB_HOST}',
          port: '${DB_PORT}',
        },
      }

      const envVars = {
        DB_HOST: 'localhost',
        // DB_PORT is missing
      }

      assert.throws(
        () => replaceEnvVariablesStrict(input, ['DB_HOST', 'DB_PORT'], envVars),
        /Missing required environment variables: DB_PORT/
      )
    })

    it('should throw error with multiple missing variables', () => {
      const input = {
        config: {
          a: '${VAR_A}',
          b: '${VAR_B}',
          c: '${VAR_C}',
        },
      }

      const envVars = {
        VAR_B: 'value_b',
      }

      assert.throws(
        () => replaceEnvVariablesStrict(input, ['VAR_A', 'VAR_B', 'VAR_C'], envVars),
        /Missing required environment variables: VAR_A, VAR_C/
      )
    })

    it('should throw with empty required variables array', () => {
      const input = { test: '${TEST_VAR}' }
      const envVars = {}

      assert.throws(() => replaceEnvVariablesStrict(input, [], envVars), /Environment variable TEST_VAR is not defined/)
    })

    it('should use process.env by default for strict mode', () => {
      const originalValues = {
        STRICT_TEST_VAR_1: process.env.STRICT_TEST_VAR_1,
        STRICT_TEST_VAR_2: process.env.STRICT_TEST_VAR_2,
      }

      process.env.STRICT_TEST_VAR_1 = 'value1'
      process.env.STRICT_TEST_VAR_2 = 'value2'

      try {
        const input = {
          var1: '${STRICT_TEST_VAR_1}',
          var2: '${STRICT_TEST_VAR_2}',
        }

        const result = replaceEnvVariablesStrict(input, ['STRICT_TEST_VAR_1', 'STRICT_TEST_VAR_2'])

        assert.strictEqual(result.var1, 'value1')
        assert.strictEqual(result.var2, 'value2')
      } finally {
        // Clean up
        for (const [key, value] of Object.entries(originalValues)) {
          if (value !== undefined) {
            process.env[key] = value
          } else {
            delete process.env[key]
          }
        }
      }
    })
  })
})
