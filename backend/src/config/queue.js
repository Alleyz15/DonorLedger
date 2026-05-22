// config/queue.js
//
// Bull + Redis. Used to push AI analysis off the HTTP request thread so
// that POST /api/evidence/submit returns quickly. The disbursement record
// lands in the DB immediately; Gemini analysis happens asynchronously.

import Bull from 'bull'
import { env } from './env.js'

const redisConfig = {
  redis: {
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100, // keep last 100 successes for inspection
    removeOnFail: 500,
  },
}

export const aiAnalysisQueue = new Bull('ai-analysis', redisConfig)
export const alertQueue = new Bull('alerts', redisConfig)

// Surface queue-level failures — without this they're invisible.
for (const q of [aiAnalysisQueue, alertQueue]) {
  q.on('error', (err) => console.error(`[queue:${q.name}] error`, err))
  q.on('failed', (job, err) =>
    console.error(`[queue:${q.name}] job ${job.id} failed`, err.message)
  )
}

export default { aiAnalysisQueue, alertQueue }
