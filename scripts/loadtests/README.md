# Performance testing

Using [k6](https://k6.io/).

Remember to **disable cache** in config before testing.

```shell
k6 run scripts/loadtests/articleSearch.js
```

```shell
k6 run scripts/loadtests/embeddings.js
```
