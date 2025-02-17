import { QueryTypes, Sequelize } from 'sequelize'

const queryDistinctUsersPermissions = `
SELECT
  b.bitmap AS bitmap, 
  LPAD(BIN(CONV(HEX(SUBSTRING(b.bitmap, 1, 8)), 16, 10)), 64, '0') AS bin_bitmap,
  MIN(user_id) as sample_user_id,
  MIN(u.email) as sample_user_email
FROM impresso_userbitmap AS b
JOIN auth_user AS u ON u.id=b.user_id
WHERE u.is_active = 1
GROUP BY b.bitmap
ORDER BY bin_bitmap
`
// CONV(HEX(SUBSTRING(b.bitmap, 1, 8)), 16, 10) AS int64_bitmap,

interface Record {
  bitmap: Buffer
  // int64_bitmap: number
  bin_bitmap: string
  sample_user_id: number
  sample_user_email: string
}

export type UserAccount = Omit<Record, 'bitmap'> & {
  bitmap: BigInt
}

export const getUserAccountsWithAvailablePermissions = async (dbClient: Sequelize): Promise<UserAccount[]> => {
  const results = await dbClient.query<Record>(queryDistinctUsersPermissions, {
    type: QueryTypes.SELECT,
  })
  return results.map(record => {
    const { bitmap, ...rest } = record
    return { ...rest, bitmap: BigInt(`0b${record.bin_bitmap}`) }
  })
}
