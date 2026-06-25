import { SolrServerNamespaceConfiguration } from '@/models/generated/app/configuration.js'
import { SolrNamespace } from '@/solr.js'

const fromYamlFieldEntries = (fieldEntries?: string[]): Record<string, string> => {
  if (fieldEntries == null) return {}

  return fieldEntries.reduce(
    (map, entry) => {
      const [model, fieldName] = entry.split(':')
      if (model != null && fieldName != null) {
        map[model] = fieldName
      }
      return map
    },
    {} as Record<string, string>
  )
}

export const getEmbeddingModelToFieldMap = (
  solrNamespacesConfiguration: SolrServerNamespaceConfiguration[],
  namespace: SolrNamespace,
  yamlFieldEntries?: string[]
): Record<string, string> => {
  const namespaceConfiguration = solrNamespacesConfiguration.find(ns => ns.namespaceId === namespace)
  const configured =
    namespaceConfiguration?.embeddingModels?.reduce(
      (acc, item) => {
        acc[item.model] = item.field
        return acc
      },
      {} as Record<string, string>
    ) ?? {}

  if (Object.keys(configured).length > 0) {
    return configured
  }

  const fromYaml = fromYamlFieldEntries(yamlFieldEntries)
  if (Object.keys(fromYaml).length > 0) {
    return fromYaml
  }

  return {}
}

export const getEmbeddingFields = (
  solrNamespacesConfiguration: SolrServerNamespaceConfiguration[],
  namespace: SolrNamespace
): string[] => {
  return Object.values(getEmbeddingModelToFieldMap(solrNamespacesConfiguration, namespace))
}

export const getEmbeddingFieldVectorPairs = (
  solrNamespacesConfiguration: SolrServerNamespaceConfiguration[],
  namespace: SolrNamespace
): Array<{ fieldName: string; vectorName: string }> => {
  return Object.entries(getEmbeddingModelToFieldMap(solrNamespacesConfiguration, namespace)).map(
    ([vectorName, fieldName]) => ({
      fieldName,
      vectorName,
    })
  )
}
