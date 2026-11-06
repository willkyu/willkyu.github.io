import contract from '../../public/homepage-item-types.json'
import type { CardAppearance } from './types'

interface ItemTypeDefinition {
  appearance: CardAppearance
  coverRequired: boolean
  description: string
}

export const homepageItemTypeContract = contract
export const homepageFeedSchemaVersion = contract.feedSchemaVersion
export const homepageItemTypes = contract.itemTypes as ItemTypeDefinition[]
export const supportedAppearances = new Set(homepageItemTypes.map((item) => item.appearance))
export const coverRequiredAppearances = new Set(
  homepageItemTypes.filter((item) => item.coverRequired).map((item) => item.appearance),
)
export const feedItemKeys = new Set([
  ...contract.feedItem.requiredFields,
  ...contract.feedItem.optionalFields,
])
export const forbiddenFeedItemFields = new Set(contract.feedItem.forbiddenFields)
