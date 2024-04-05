local hgetall = function (key)
  local bulk = redis.call("HGETALL", key)
  local result = {}
  local nextkey
  for i, v in ipairs(bulk) do
    if i % 2 == 1 then
      nextkey = v
    else
      result[nextkey] = v
    end
  end
  return result
end

-- Take token out of the bucket in case it was added but the
-- rate limited request failed due to our fault.

local key = KEYS[1]

local items = hgetall(key)
local tokens = tonumber(items['tokens'] or 0)

if tokens > 0 then
  redis.call('HSET', key, 'tokens', tokens - 1)
  return true
end