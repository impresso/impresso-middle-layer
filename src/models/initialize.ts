import { Sequelize } from 'sequelize'
import SpecialMembershipAccess from './special-membership-access.model'
import UserSpecialMembershipRequest from './user-special-membership-requests.model'

export interface IModel {
  initialize: (sequelize: Sequelize) => void
  associate?: () => void
}

// Export all models in an array in the
export const Models: IModel[] = [SpecialMembershipAccess, UserSpecialMembershipRequest]
// Helper function to initialize all models
export function initializeModels(sequelize: Sequelize): void {
  Models.forEach(model => {
    if (model.initialize) {
      model.initialize(sequelize)
    } else {
      throw new Error(`Model ${model} does not have an initialize method`)
    }
  })
  console.log('Registered models:', Object.keys(sequelize.models))
}

// Helper function to set up associations
export function associateModels(sequelize: Sequelize): void {
  Models.forEach(model => {
    if (model.associate) {
      model.associate()
    } else {
      throw new Error(`Model ${model} does not have an associate method`)
    }
  })
}
