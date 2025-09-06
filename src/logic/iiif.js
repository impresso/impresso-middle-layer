
const QueryGetIIIFManifests = `
  SELECT id, iiif_manifest as iiifUrl
  FROM pages
  WHERE id IN (:pageIds)
`;

export default {
  QueryGetIIIFManifests,
};
