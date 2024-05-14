# JSON schemas
This directory contains JSON schemas for the various types of data that are used in the project.
The directory is organised following OpenAPI 3.0 specification, with each schema belonging to a specific category.
See the supported categories here: https://spec.openapis.org/oas/v3.0.0.html#fixed-fields-5

## Structure

We normally only use the `schemas` directory. Everything else is created dynamically in the code.

**NOTE** OAS [JSON Schemas](https://swagger.io/docs/specification/data-models/) are based on JSON Schema Draft 5, but has some differences. While we convert the schemas automatically, one thing we don't do is dereferencing the `definitions` section which is not supported by OAS. 

This means that schemas in `schemas` directory *must not use definitions section*.