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

-- Leaky bucket rate limiter
-- add a token to bucket every time this script is called
-- when bucket is at capacity and no tokens have leaked yet, the request is denied

local key = KEYS[1]
local capacity = tonumber(ARGV[1]) -- Bucket capacity (10)
local rate = tonumber(ARGV[2]) -- Refill rate items / sec (e.g. 0.16 for 10 tokens per 60 second)
local current_time_sec = redis.call("TIME")[1]

local items = hgetall(key)

local tokens = tonumber(items['tokens'] or 0)
local last_refreshed_sec = items['last_refreshed_sec'] or current_time_sec

-- Calculate elapsed time and potential token refill
local elapsed_sec = current_time_sec - last_refreshed_sec
local leak_amount = math.floor(elapsed_sec * rate)
local remaining_tokens = math.max(0, tokens - leak_amount)

-- new tokens is remaining + 1 (used now)
local new_tokens = math.min(remaining_tokens + 1, capacity)

-- Update hash with new tokens and timestamp
redis.call('HSET', key, 'tokens', new_tokens, 'last_refreshed_sec', current_time_sec)

-- Allow request if there is space for new tokens
-- return remaining_tokens < capacity
return remaining_tokens
