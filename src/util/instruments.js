async function measureTime(fn, label, doLog = undefined) {
  const hrstart = process.hrtime();
  const onEnd = () => {
    const hrend = process.hrtime(hrstart);
    const ms = (hrend[0] * 1000) + (hrend[1] / 1e6);
    const print = doLog != null
      ? doLog
      : process.env.LOG_TIMING === '1';

    if (print) {
      console.log(`⏱: "${label}" took ${ms.toFixed(2)} ms.`);
    }
  };
  return fn()
    .then((x) => {
      onEnd();
      return x;
    })
    .catch((e) => {
      onEnd();
      throw e;
    });
}

module.exports = { measureTime };
