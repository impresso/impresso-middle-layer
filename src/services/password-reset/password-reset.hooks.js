const { validate, REGEX_EMAIL, REGEX_PASSWORD } = require('../../hooks/params')

module.exports = {
  before: {
    create: [
      // validate email in context data
      validate(
        {
          email: {
            required: true,
            regex: REGEX_EMAIL,
          },
        },
        'POST'
      ),
    ],
    patch: [
      // validate a JWT token using a regular expression
      validate(
        {
          token: {
            required: true,
            regex: /^[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+$/,
          },
          password: {
            required: true,
            regex: REGEX_PASSWORD,
          },
        },
        'POST'
      ),
    ],
  },
}
