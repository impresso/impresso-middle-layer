
const sequelizeRecordMapper = (record) => {
  /*
   transform an array of sequelize model isntance to a nice Object
   [ newspaper {
     dataValues: { id: 1, uid: 'GDL', name: 'Journal de Geneve' },
     _previousDataValues: { id: 1, uid: 'GDL', name: 'Journal de Geneve' },
     _changed: {},
     _modelOptions:
    ...
   ]
  */
  return record.toJSON()
}



module.exports = {
  sequelizeRecordMapper
}
