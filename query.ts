import { generateRandomQuery } from "ibm-graphql-query-generator";
import { buildSchema, print } from "graphql";

const schema = `
  type Query {
    getUser(name: String!): User
    getCompany(companyName: String!): Company
  }

  type User {
    firstName: String
    lastName: String
    employer: Company
    friends: [User]
  }

  type Company {
    name: String
    CEO: User
    employees: [User]
  }
`

const configuration = {
  depthProbability: 0.5,
  breadthProbability: 0.5,
  providerMap: {
    "*__*__name": () => {
      const nameList = ["Alfred", "Barbara", "Charles", "Dorothy"]

      return nameList[Math.floor(Math.random() * nameList.length)]
    },
    "*__*__companyName": () => {
      const companyNameList = [
        "All Systems Go",
        "Business Brothers",
        "Corporate Comglomerate Company",
        "Data Defenders"
      ]

      return companyNameList[
        Math.floor(Math.random() * companyNameList.length)
      ]
    }
  }
}

const { queryDocument, variableValues, seed } = generateRandomQuery(
  buildSchema(schema),
  configuration
)

console.log(print(queryDocument))
console.log(variableValues)