import { Filter } from '@/models/index.js'
import baseFilterBuilderFn, {
  defaultItemBuilder,
  noPrefixFilterFieldConverter,
} from '@/util/solr/filterBuilders/base.js'
import { FilterBuilderFn, FilterField } from '@/util/solr/filterBuilders/types.js'
import { escapeString } from '@/util/solr/filterBuilders/value.js'

const toCapitalised = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const transformValue = (value: string): string => escapeString(toCapitalised(value))

const valueBuilder: FilterBuilderFn = (filters: Filter[], filterField: FilterField, ruleName: string) => {
  return baseFilterBuilderFn(
    filters,
    filterField,
    ruleName,
    transformValue,
    defaultItemBuilder,
    noPrefixFilterFieldConverter
  )
}

export default valueBuilder
