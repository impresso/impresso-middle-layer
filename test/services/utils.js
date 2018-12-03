const app = require('../../src/app');
const sequelize = require('../../src/sequelize');

const Collection = require('../../src/models/collections.model');
const User = require('../../src/models/users.model');

const removeGeneratedUser = async (user) => {
  const client = sequelize.client(app.get('sequelize'));
  // get user if any
  const userInDb = await User.sequelize(client).findOne({
    where: {
      username: user.username,
    },
  });

  if (userInDb) {
    await Collection.sequelize(client).destroy({
      where: {
        creator_id: userInDb.id,
      },
    });
  }

  // remove all
  await app.service('users').remove(user.username, {
    user: {
      is_staff: true,
    },
  });
};

const generateUser = async (user) => {
  await removeGeneratedUser(user);
  const result = await app.service('users').create({
    ...user,
  });
  return result;
};


module.exports = {
  generateUser,
  removeGeneratedUser,
};
