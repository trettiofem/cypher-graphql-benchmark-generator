# GraphQL Testing

Generates Cypher queries using the [Neo4j GraphQL Library](https://neo4j.com/docs/graphql/current/) and [ibm-graphql-query-generator](https://github.com/IBM/graphql-query-generator).

## Config

```ts
// See main.ts

const STAGES = [
  {
    // Name of stage
    name: "...",
    nbrOfQueries: 10,
    // Range: 0.0 -> 1.0
    depthProbability: 1.0,
    // Range: 0.0 -> 1.0
    breadthProbability: 1.0,
    // The maximum depths of the query to generate
    maxDepth: 1,
  }
  // ...
];

// Neo4j config
const NEO4J_URI = "...";
const NEO4J_USERNAME = "...";
const NEO4J_PASSWORD = "...";

// Apollo config
const APOLLO_PORT = 4067;

// Output file, {} is replaced with the name of the stage
const OUTPUT_FILE = "queries_{}.txt";
```

## Usage

```bash
# Setup Neo4j database
sudo docker-compose up -d

# Install dependencies
deno install

# Generate queries
deno run dev
```