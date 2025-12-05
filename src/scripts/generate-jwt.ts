// index.ts
import initConfig from '@feathersjs/configuration'

import chalk from 'chalk'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Config } from '../models/generated/common'
import { replaceEnvVariables } from '@/util/configuration'
import jwt, { SignOptions } from 'jsonwebtoken'
import User from '../models/users.model'
import { getSequelizeClient } from '../sequelize'
import Group from '@/models/groups.model'
import { bigIntToBuffer } from '@/util/bigint'
import { BufferUserPlanGuest } from '@/models/user-bitmap.model'

const config = initConfig()() as any as Config

const db = getSequelizeClient(replaceEnvVariables(config.sequelize)!)

const userModel = User.sequelize(db.client)

// --- 1. Rainbow Text Function (Remains the same) ---
const JWTSecret = replaceEnvVariables(config.authentication.secret)
const JWTOptions = replaceEnvVariables(config.authentication.jwtOptions)!

/**
 * Validates and converts an ISO date string to a Unix timestamp for JWT expiration.
 *
 * @param dateISO - ISO 8601 date string (e.g., "2026-12-31T10:00:00Z") OR number of seconds since epoch
 * @returns Unix timestamp in seconds, or null if no date provided
 * @throws Error if the date is invalid or in the past
 */
function getValidJWTTimestamp(dateISO: string | number | null | undefined): number {
  if (!dateISO) {
    return new Date().getTime()
  }
  const isTimestamp = typeof dateISO === 'number' || !isNaN(parseInt(dateISO as string))
  // Attempt to create a Date object from the ISO string
  const date = isTimestamp ? new Date(dateISO) : new Date(parseInt(dateISO as string) * 1000)
  // Validation Step 1: Check if the date is valid
  if (isNaN(date.getTime())) {
    throw new Error(
      `Invalid ISO date format provided: ${dateISO}. ` + `Expected format: 2026-12-31T10:00:00Z or a valid timestamp.`
    )
  }
  console.log('date:', dateISO, chalk.blue(`Parsed date: ${date.toISOString()}`))
  if (isTimestamp) {
    return parseInt(dateISO as string)
  }
  // Convert milliseconds to Unix timestamp (seconds) for JWT 'exp' field
  return Math.floor(date.getTime() / 1000)
}

function getValidEmail(email: string): string {
  // --- 3. Email Validation (Remains the same) ---
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(email)) {
    console.error(chalk.red.bold(`🛑 Error: Invalid email format for: ${chalk.cyan(email)}`))
    throw new Error(`Invalid email format: ${email}`)
  }
  return email
}

function generatePublicApiToken(
  payload: {
    userId: string
    sub: string
    bitmap: string
    isStaff: boolean
    groups: string[]
  },
  config: {
    secret: string
    audience?: string
    issuer?: string
    expiresIn?: string
    algorithm?: string
    notBefore?: string
    jti?: string
    typ?: string
  }
) {
  const {
    secret,
    audience,
    issuer = 'feathers',
    expiresIn = '1d',
    algorithm = 'HS256',
    notBefore = '0s',
    jti,
    typ,
  } = config

  const options: SignOptions = {
    expiresIn,
    notBefore,
    issuer,
    algorithm: algorithm as jwt.Algorithm,
    header: {
      typ,
      alg: algorithm,
    },
  }

  // Only add audience to options if it exists (to match your imlOps logic)
  if (audience) {
    options.audience = audience
  }
  if (jti) {
    options.jwtid = jti
  }
  console.log('Generating JWT with options:', options)
  console.log('Payload:', payload)
  return jwt.sign(payload, secret, options)
}

function createSineRainbowText(text: string, lettersPerCycle: number = 3): string {
  let coloredText = ''
  const chars = text.split('')
  const frequency = (Math.PI * 2) / lettersPerCycle

  for (let i = 0; i < chars.length; i++) {
    const phase = i * frequency
    const r = Math.floor(Math.sin(phase) * 127 + 128)
    const g = Math.floor(Math.sin(phase + (Math.PI * 2) / 3) * 127 + 128)
    const b = Math.floor(Math.sin(phase + (Math.PI * 4) / 3) * 127 + 128)

    coloredText += chalk.bold.rgb(r, g, b)(chars[i])
  }

  return coloredText
}

// --- 2. Main Application Logic ---

/**
 * Executes the JWT Generator CLI logic.
 */
async function main() {
  console.log(createSineRainbowText('Welcome to the JWT Generator Script!'))
  console.log(chalk.gray('-'.repeat(64)))

  console.log('\nJWT Secret from configuration:', chalk.blue.bold(JWTSecret.slice(0, 4) + '...' + JWTSecret.slice(-4)))

  console.log('\nJWT Options from configuration:')
  console.log(JSON.stringify(JWTOptions, null, 2))

  // Define the arguments using yargs
  const args = yargs(hideBin(process.argv))
    .option('exp', {
      alias: 'e',
      type: 'number',
      description: 'Optional expiration date in ISO 8601 format (e.g., 2026-12-31T10:00:00Z) or in SECONDS since epoch',
      demandOption: false,
    })
    .option('iat', {
      alias: 'i',
      type: 'number',
      description: 'Optional issued at date in ISO 8601 format (e.g., 2026-12-31T10:00:00Z) or in SECONDS since epoch',
      demandOption: false,
    })
    .option('email', {
      type: 'string',
      description: 'The user email for the JWT payload (required)',
      demandOption: true,
    })
    .help()
    .alias('h', 'help')
    .parseSync()

  const userEmail = getValidEmail(args.email)
  const exp = getValidJWTTimestamp(args.exp)
  const iat = getValidJWTTimestamp(args.iat)

  const user = await userModel.findOne({ where: { email: userEmail }, include: ['groups', 'profile', 'userBitmap'] })
  if (!user) {
    throw new Error(`No user found with email: ${userEmail}`)
  }
  // get groups
  const userAny = user as any

  const userId = (userAny.profile && userAny.profile.uid) || 'unknown'
  const groups = (userAny.groups || []).map((g: Group) => g.name)
  const sub = String(userAny.id)
  const isStaff = Boolean(userAny.isStaff)
  const bitmap = userAny.userBitmap != null ? userAny.userBitmap.bitmap : BufferUserPlanGuest

  console.log(chalk.bold('\nUser found:'))
  console.log('ID:', chalk.cyan.bold(sub))
  console.log('UID:', chalk.cyan.bold(userId))
  console.log('Email:', chalk.cyan.bold(userEmail))
  console.log('isStaff:', chalk.cyan.bold(isStaff))
  console.log('Groups:', chalk.cyan.bold(groups.join(', ')))
  console.log('bitmap', chalk.green.bold(bigIntToBuffer(bitmap).toString('base64')))

  const generatedToken = generatePublicApiToken(
    {
      userId,
      sub,
      bitmap: bigIntToBuffer(bitmap).toString('base64'),
      isStaff,
      groups,
    },
    {
      secret: JWTSecret,
      audience: JWTOptions.audience as string,
      issuer: JWTOptions.issuer as string,
      expiresIn: String(exp),
      algorithm: JWTOptions.algorithm as string,
      notBefore: String(iat),
      typ: (JWTOptions.header! as { typ: string }).typ as string,
    }
  )

  console.log(chalk.green.bold('\n✅ JWT Generated Successfully!'))
  console.log(chalk.whiteBright('Generated JWT:'))
  console.log(chalk.magenta(generatedToken))

  // close db connection
  await db.client.close()
}

// Execute the main function
main()
