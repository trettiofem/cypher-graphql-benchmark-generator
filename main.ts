import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { Neo4jGraphQL } from "@neo4j/graphql";
import neo4j from "neo4j-driver";
import { generateRandomQuery } from "ibm-graphql-query-generator";
import { print as printGraphQL } from "graphql";
import { GraphQLSchema } from "graphql";
import GRAPHQL_SCHEMA from "./schema.graphql" with { type: "text" };

const NBR_OF_QUERIES = 1;
const DEPTH_PROBABILITY = 0.8;
const BREADTH_PROBABILITY = 0.1;
const MAX_DEPTH = 25;

const NEO4J_URI = "neo4j://localhost:7687";
const NEO4J_USERNAME = "neo4j";
const NEO4J_PASSWORD = "password";

const APOLLO_PORT = 4067;

async function startServer(
  onQuery: (query: string, params: object, unknown: object) => void,
): Promise<[string, GraphQLSchema, () => Promise<void>]> {
  const logRegex = /RUN ([^]*) ({[^]*}) ({})/m;

  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD),
    {
      logging: {
        level: "debug",
        logger: (level, message) => {
          if (level === "debug" && message.includes("RUN")) {
            const match = logRegex.exec(message);

            if (match) {
              const [query, params, unknown] = [match[1], match[2], match[3]];
              onQuery(query, JSON.parse(params), JSON.parse(unknown));
            }
          }
        },
      },
    },
  );

  const neoSchema = new Neo4jGraphQL({ typeDefs: GRAPHQL_SCHEMA, driver });
  const schema = await neoSchema.getSchema();

  const server = new ApolloServer({
    schema,
  });

  const { url } = await startStandaloneServer(server, {
    context: async ({ req }) => ({ req }),
    listen: { port: APOLLO_PORT },
  });

  console.log(`🚀 Server ready at ${url}`);
  return [
    url,
    schema,
    async () => {
      await server.stop();
      await driver.close();
    },
  ];
}

async function main() {
  const onQuery = (query: string, params: object, unknown: object) => {
    if (query.startsWith("CYPHER 5\nCALL dbms.components()")) return;

    console.log("--- onQuery() ---");
    console.log(query);
    console.log(JSON.stringify(params));
    console.log(JSON.stringify(unknown) + "\n");
  };

  const [url, schema, shutdown] = await startServer(onQuery);

  for (let i = 0; i < NBR_OF_QUERIES; i++) {
    const { queryDocument, variableValues } = generateRandomQuery(schema, {
      depthProbability: DEPTH_PROBABILITY,
      breadthProbability: BREADTH_PROBABILITY,
      maxDepth: MAX_DEPTH,
      providePlaceholders: true,
    });

    console.log(`--- Request ${i + 1} of ${NBR_OF_QUERIES} ---`);
    console.log(printGraphQL(queryDocument));
    console.log(JSON.stringify(variableValues) + "\n");

    const res = await fetch(url, {
      body: JSON.stringify({
        operationName: "RandomQuery",
        query: printGraphQL(queryDocument),
        variables: variableValues,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    console.log(`--- Response from request ${i + 1} of ${NBR_OF_QUERIES} ---`);
    const resBody = await res.text();
    console.log(resBody + "\n");
  }

  await shutdown();
}

if (import.meta.main) main();
