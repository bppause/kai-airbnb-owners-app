const isProduction = process.env.NODE_ENV === 'production';
const debugEnabled = process.env.DEBUG === 'true';
const shouldLogDebug = !isProduction || debugEnabled;

const log = (...args) => {
  if (shouldLogDebug) console.log(...args);
};

const warn = (...args) => console.warn(...args);
const error = (...args) => console.error(...args);

module.exports = { log, warn, error };
