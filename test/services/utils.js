const app = require('../../src/app');

const removeGeneratedUser = async (user) => {
  await app.service('users').remove(user.username, {
    user: {
      is_staff: true,
    },
  });
};

const generateUser = async (user) => {
  await removeGeneratedUser(user);
  const result = await app.service('users').create(user);
  return result;
};


module.exports = {
  generateUser,
  removeGeneratedUser,
};
