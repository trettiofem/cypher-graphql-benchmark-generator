import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { Neo4jGraphQL } from "@neo4j/graphql";
import neo4j from "neo4j-driver";
import { generateRandomQuery, ProviderMap } from "ibm-graphql-query-generator";
import { buildSchema, print } from "graphql";

const NBR_OF_QUERIES = 1;
const DEPTH_PROBABILITY = 0.5;
const BREADTH_PROBABILITY = 0.5;

const NEO4J_URI = "neo4j://localhost:7687";
const NEO4J_USERNAME = "neo4j";
const NEO4J_PASSWORD = "password";

const APOLLO_PORT = 4067;

const GRAPHQL_SCHEMA = `#graphql
type Product @node {
    productName: String
    category: [Category!]! @relationship(type: "PART_OF", direction: OUT)
}

type Category @node {
    categoryName: String
    products: [Product!]! @relationship(type: "PART_OF", direction: IN)
}
`;

const GRAPHQL_PROVIDER_MAP: ProviderMap = {
  "*__*__name": () => {
    const nameList = ["Alfred", "Barbara", "Charles", "Dorothy"];

    return nameList[Math.floor(Math.random() * nameList.length)];
  },
  "*__*__companyName": () => {
    const companyNameList = [
      "All Systems Go",
      "Business Brothers",
      "Corporate Comglomerate Company",
      "Data Defenders",
    ];

    return companyNameList[Math.floor(Math.random() * companyNameList.length)];
  },
};

async function startServer(
  onQuery: (query: string, params: object, unknown: object) => void,
): Promise<string> {
  const logRegex = /RUN ([^]*) ({[^]*}) ({})/gm;

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

  const server = new ApolloServer({
    schema: await neoSchema.getSchema(),
  });

  const { url } = await startStandaloneServer(server, {
    context: async ({ req }) => ({ req }),
    listen: { port: APOLLO_PORT },
  });

  console.log(`🚀 Server ready at ${url}`);
  return url;
}

async function main() {
  const onQuery = (query: string, params: object, unknown: object) => {
    console.log("---");
    console.log(query);
    console.log(params);
    console.log(unknown);
  };

  // const url = await startServer(onQuery);

  // Generate and send queries
  const neoSchema = new Neo4jGraphQL({ typeDefs: GRAPHQL_SCHEMA });
  const schema = await neoSchema.getSchema()

  for (let i = 0; i < NBR_OF_QUERIES; i++) {
    const { queryDocument, variableValues } = generateRandomQuery(schema, {
      depthProbability: DEPTH_PROBABILITY,
      breadthProbability: BREADTH_PROBABILITY,
      providerMap: GRAPHQL_PROVIDER_MAP,
    });

    console.log(print(queryDocument));
    console.log(variableValues);
  }
}

if (import.meta.main) main();
