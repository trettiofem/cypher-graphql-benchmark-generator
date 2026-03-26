import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { Neo4jGraphQL } from "@neo4j/graphql";
import neo4j from "neo4j-driver";
import { generateRandomQuery } from "ibm-graphql-query-generator";
import { print as printGraphQL } from "graphql";
import { GraphQLSchema } from "graphql";
import GRAPHQL_SCHEMA from "./schema.graphql" with { type: "text" };
import { assert } from "node:console";

const STAGES = [
  {
    name: "Mini",
    nbrOfQueries: 300,
    depthProbability: 0.1,
    breadthProbability: 0.1,
    maxDepth: 2,
  },
  {
    name: "Small",
    nbrOfQueries: 300,
    depthProbability: 0.1,
    breadthProbability: 0.1,
    maxDepth: 10,
  },
  {
    name: "Medium",
    nbrOfQueries: 300,
    depthProbability: 0.5,
    breadthProbability: 0.15,
    maxDepth: 20,
  },
  {
    name: "Large",
    nbrOfQueries: 300,
    depthProbability: 0.9,
    breadthProbability: 0.15,
    maxDepth: 30,
  },
];

const NEO4J_URI = "neo4j://localhost:7687";
const NEO4J_USERNAME = "neo4j";
const NEO4J_PASSWORD = "password";
const APOLLO_PORT = 4067;
const OUTPUT_FILE = "queries_{}.txt";

const queries: string[] = [];

async function startServer(
  onQuery: (query: string) => void,
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
              onQuery(match[1]);
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
      console.log("👋 Goodbye!");
    },
  ];
}

async function main() {
  const onQuery = (query: string) => {
    if (query.startsWith("CYPHER 5\nCALL dbms.components()")) return;
    queries.push(query);
  };

  const [url, schema, shutdown] = await startServer(onQuery);

  for (const stage of STAGES) {
    for (let i = 0; i < stage.nbrOfQueries; i++) {
      try {
        console.log(`[${stage.name}] Query ${i + 1}/${stage.nbrOfQueries}`);

        const { queryDocument, variableValues } = generateRandomQuery(schema, {
          depthProbability: stage.depthProbability,
          breadthProbability: stage.breadthProbability,
          maxDepth: stage.maxDepth,
          providePlaceholders: true,
        });

        assert(Object.keys(variableValues).length === 0, "Variables generated");

        await fetch(url, {
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
      } catch (_) {
        console.error("Error occured, trying again.");
        i--;
      }
    }

    const stageOutputFile = OUTPUT_FILE.replace("{}", stage.name.toLowerCase());

    await Deno.writeTextFile(stageOutputFile, queries.join(";\n"));
    console.log(`💾 Queries written to ${stageOutputFile}`);

    queries.length = 0; // Clear the queries array for the next stage
  }

  await shutdown();
}

if (import.meta.main) main();
